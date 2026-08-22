import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import type { IncomingMessage, ServerResponse } from 'http'

/**
 * Vite plugin to handle Netlify serverless functions in local development (npm run dev).
 * Intercepts POST /.netlify/functions/ai-invoice and dispatches to netlify/functions/ai-invoice.ts handler.
 */
function netlifyFunctionsDevPlugin(): Plugin {
  return {
    name: 'netlify-functions-dev',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ? req.url.split('?')[0] : ''
        if (url === '/.netlify/functions/ai-invoice') {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            res.end()
            return
          }

          if (req.method === 'POST') {
            let rawBody = ''
            req.on('data', (chunk: Buffer) => {
              rawBody += chunk.toString()
            })

            req.on('end', async () => {
              try {
                const { handler } = await server.ssrLoadModule('/netlify/functions/ai-invoice.ts')
                const headersRecord: Record<string, string | undefined> = {}
                for (const [key, value] of Object.entries(req.headers)) {
                  headersRecord[key] = Array.isArray(value) ? value.join(', ') : value
                }

                const event = {
                  path: req.url || '/.netlify/functions/ai-invoice',
                  httpMethod: 'POST',
                  headers: headersRecord,
                  body: rawBody,
                  isBase64Encoded: false,
                }

                const result = await handler(event)

                res.statusCode = result.statusCode || 200
                if (result.headers) {
                  for (const [key, value] of Object.entries(result.headers)) {
                    res.setHeader(key, String(value))
                  }
                }
                res.end(result.body || '')
              } catch (err: unknown) {
                console.error('Local serverless dev execution error:', err)
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Local serverless function execution failed in development mode.',
                  })
                )
              }
            })
            return
          }
        }
        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), netlifyFunctionsDevPlugin()],
})
