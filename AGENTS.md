

# Agent Rules <!-- tessl-managed -->

@.tessl/RULES.md follow the [instructions](.tessl/RULES.md)

## IPC Envelope Wrapping (CRITICAL -- read before touching IPC)

`registerHandler` in `electron/managers/IPCManager.ts` automatically wraps every
handler's return value. If a handler returns `{ files, folderName }`, the
renderer actually receives:

```json
{ "success": true, "data": { "files": [...], "folderName": "..." } }
```

On error (handler throws), the renderer receives:

```json
{ "success": false, "error": "message" }
```

The only exception is channels listed in `unwrappedChannels` (currently just
`"go-daemon-command"`), which pass the handler's return value through as-is.

### Rules for new IPC channels

1. **Handlers must return raw data only.** Do NOT include `success` or `error`
   fields in the return value -- the wrapper adds those. Signal errors by
   throwing.

2. **Preload must unwrap the envelope.** Every preload bridge function should
   check `r.success`, throw on failure, and return `r.data`:

   ```typescript
   myChannel: (arg: string): Promise<MyType> =>
     ipcRenderer.invoke("my-channel", arg).then(
       (r: { success: boolean; data: MyType; error?: string }) => {
         if (!r.success) throw new Error(r.error ?? "my-channel failed");
         return r.data;
       }
     ),
   ```

3. **Type declarations in `src/types/electron.d.ts` should reflect the
   unwrapped type** (i.e., `Promise<MyType>`), not the envelope.

4. **React code never sees the envelope.** If you find yourself checking
   `result.success` or accessing `result.data` in React components or stores,
   something is wrong -- the preload should have already unwrapped it.
