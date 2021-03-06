import WebSocket from 'ws'

import Automerge, { Text } from 'automerge'

// const CodecFunctions = require('automerge-wasm-node/backend/columnar')
// import wasmBackend from 'automerge-backend-wasm-nodejs'
// wasmBackend.initCodecFunctions(CodecFunctions)
// Automerge.setDefaultBackend(wasmBackend)

const http = require('http')

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1

export const docs = new Map<string, WSSharedDoc>()

export type Doc = {
  docId: string;
  textArea: Text;
};

const send = (conn, doc: WSSharedDoc, payload: any) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    onClose(doc, conn, null)
  }
  try {
    conn.send(payload, (err: any) => { err != null && onClose(doc, conn, err) })
  } catch (e) {
    onClose(doc, conn, e)
  }
}

class WSSharedDoc {
  private name = null;
  public doc: Doc = null;
  public conns = new Map()
  constructor(doc: Doc) {
    this.doc = doc;
    this.name = doc.docId;
  }
}

const onMessage = (conn, docName, sharedDoc: WSSharedDoc, message: any) => {
  const data = JSON.parse(message);
  data.forEach((chunk) => {
    sharedDoc.doc = Automerge.applyChanges(sharedDoc.doc, [new Uint8Array(Object.values(chunk))])
  });
  sharedDoc.conns.forEach((_, cnx) => { if (cnx != conn) { send(cnx, sharedDoc, message) } })
}

export const getSharedDoc = (docName: string): WSSharedDoc => {
  const k = docs.get(docName)
  if (k) {
    return k
  }
  const d = Automerge.init<Doc>()
  const d1 = Automerge.change(d, doc => {
    doc.docId = docName;
    doc.textArea = new Automerge.Text();
    doc.textArea.insertAt(0, ...'hello from Node.js!')
    doc.textArea.deleteAt(0)
    doc.textArea.insertAt(0, 'H')
  })
  const sharedDoc = new WSSharedDoc(d1)
  docs.set(docName, sharedDoc)
  return sharedDoc
}

const onClose = (conn, doc: WSSharedDoc, err) => {
  console.log('Closing', err)
  if (doc.conns.has(conn)) {
    doc.conns.delete(conn)
  }
  conn.close()
}

const setupWSConnection = (conn, req, { docName = req.url.slice(1).split('?')[0] as string } = {}) => {
  conn.binaryType = 'arraybuffer'
  const sharedDoc = getSharedDoc(docName)
  const changes = Automerge.getChanges(Automerge.init<Doc>(), sharedDoc.doc)

  var payload = JSON.stringify(changes);
  send(conn, sharedDoc, payload)
  sharedDoc.conns.set(conn, new Set())
  conn.on('message', message => onMessage(conn, docName, sharedDoc, message))
  conn.on('close', err => onClose(conn, sharedDoc, err))
}

const PORT = process.env.PORT || 4321
const wss = new WebSocket.Server({ noServer: true })

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('okay')
})

wss.on('connection', setupWSConnection)

server.on('upgrade', (request, socket, head) => {
  const handleAuth = ws => {
    wss.emit('connection', ws, request)
  }
  wss.handleUpgrade(request, socket, head, handleAuth)
})

server.listen(PORT)

console.log('WebSocket server running on port', PORT)
