package ipc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
)

// Client is an IPC client.
type Client struct {
	conn net.Conn
}

// NewClient creates a new IPC client.
func NewClient() (*Client, error) {
	conn, err := net.Dial("unix", SocketPath)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to socket: %w", err)
	}

	return &Client{conn: conn}, nil
}

// Close closes the client connection.
func (c *Client) Close() {
	c.conn.Close()
}

// Send sends a message to the server and returns the response.
func (c *Client) Send(msg *Message) (*Response, error) {
	data, err := json.Marshal(msg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal message: %w", err)
	}

	if _, err := c.conn.Write(data); err != nil {
		return nil, fmt.Errorf("failed to write to socket: %w", err)
	}

	reader := bufio.NewReader(c.conn)
	respData, err := reader.ReadBytes('\n')
	if err != nil {
		return nil, fmt.Errorf("failed to read from socket: %w", err)
	}

	var resp Response
	if err := json.Unmarshal(respData, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}
