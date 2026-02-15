---
name: stripe
description: Stripe payment integration guidelines for TypeScript, React, Next.js with secure payment processing and subscription management
---

# Stripe Integration

You are an expert in Stripe payment integration, TypeScript, React, and Next.js for building secure payment solutions.

## Core Principles

- Always handle payments on the server side
- Use Stripe's latest API version
- Implement proper error handling
- Follow PCI compliance best practices
- Use webhooks for reliable event handling

## Server-Side Setup

### Stripe Client Configuration

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});
```

### Create Payment Intent

```typescript
// app/api/create-payment-intent/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const { amount, currency = 'usd' } = await request.json();

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Payment intent creation failed' },
      { status: 500 }
    );
  }
}
```

## Client-Side Integration

### Stripe Elements Setup

```typescript
'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function StripeProvider({ children }: { children: React.ReactNode }) {
  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}
```

### Payment Form Component

```typescript
'use client';

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

export function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
      },
    });

    if (submitError) {
      setError(submitError.message ?? 'Payment failed');
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={!stripe || isLoading}>
        {isLoading ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}
```

## Subscription Management

### Create Subscription

```typescript
export async function createSubscription(
  customerId: string,
  priceId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
  });

  return subscription;
}
```

### Cancel Subscription

```typescript
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.cancel(subscriptionId);
}
```

## Webhook Handling

```typescript
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return new Response('Webhook signature verification failed', {
      status: 400,
    });
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentSuccess(paymentIntent);
      break;

    case 'customer.subscription.created':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCreated(subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
  }

  return new Response('Webhook processed', { status: 200 });
}
```

## Customer Management

```typescript
export async function createOrRetrieveCustomer(
  email: string,
  userId: string
): Promise<Stripe.Customer> {
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  return stripe.customers.create({
    email,
    metadata: { userId },
  });
}
```

## Security Best Practices

- Never expose secret keys on the client
- Always verify webhook signatures
- Use idempotency keys for critical operations
- Implement proper error handling
- Log payment events for debugging
- Use Stripe's test mode for development

## Error Handling

```typescript
try {
  const paymentIntent = await stripe.paymentIntents.create({...});
} catch (error) {
  if (error instanceof Stripe.errors.StripeCardError) {
    // Card was declined
    console.error('Card declined:', error.message);
  } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    // Invalid parameters
    console.error('Invalid request:', error.message);
  } else {
    // Other errors
    console.error('Stripe error:', error);
  }
}
```

## Testing

- Use Stripe test mode and test card numbers
- Test webhook events with Stripe CLI
- Implement proper error scenarios
- Test subscription lifecycle events
