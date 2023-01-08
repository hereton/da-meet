const Hyperswarm = require('hyperswarm')
const goodbye = require('graceful-goodbye')
const crypto = require('hypercore-crypto')
const b4a = require('b4a')


const conns = []

const initHyperswarm = () => {
  const swarm = new Hyperswarm()
  goodbye(() => {
    console.log('swarm destroyed')
    return swarm.destroy()})
  return swarm
}

const start = async ({ inputPublicKey }) => {
  console.log(inputPublicKey)
  const swarm = new Hyperswarm()
  goodbye(() => swarm.destroy())

  // Keep track of all connections and console.log incoming data
  swarm.on('connection', (conn) => {
    // console.log(socket)
    const name = b4a.toString(conn.remotePublicKey, 'hex')
    console.log('* got a connection from:', name, '*')
    conns.push(conn)
    conn.once('close', () => conns.splice(conns.indexOf(conn), 1))
    conn.on('data', data => console.log(`${name}: ${data}`))
  })

  // Broadcast stdin to all connections
  process.stdin.on('data', d => {
    for (const conn of conns) {
      conn.write(d)
    }
  })

  // Join a common topic
  const topic = inputPublicKey ? b4a.from(inputPublicKey, 'hex') : Buffer.alloc(32).fill('ton test')
  const discovery = swarm.join(topic, { client: true, server: true })

  // The flushed promise will resolve when the topic has been fully announced to the DHT
  discovery.flushed().then(() => {
    console.log('joined topic:', b4a.toString(topic, 'hex'))
  })

  return { publicKey: inputPublicKey ?? b4a.toString(topic, 'hex') }
}

module.exports = { start, conns, initHyperswarm }