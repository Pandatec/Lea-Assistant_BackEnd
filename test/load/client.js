const WebSocketClient = require('websocket').client

const testClient = (id) => {
  const client = new WebSocketClient()

  client.on('connectFailed', function (error) {
    console.log(`CLIENT ${id}: Connect Error: ` + error.toString())
  })

  client.on('connect', function (connection) {
    console.log(`CLIENT ${id}: WebSocket Client Connected`)
    connection.on('error', function (error) {
      console.log(`CLIENT ${id}: Connection Error: ` + error.toString())
    })
    connection.on('close', function () {
      console.log(`CLIENT ${id}: Connection Closed`)
    })
    /* connection.on('message', function(message) {
      if (message.type === 'utf8') {
        console.log("Received: '" + message.utf8Data + "'")
      }
    })

    function sendNumber () {
      if (connection.connected) {
      const number = Math.round(Math.random() * 0xFFFFFF)
      connection.sendUTF(number.toString())
      setTimeout(sendNumber, 1000)
      }
    }
    sendNumber() */
  })
  client.connect('ws://localhost/')
}

const launch = () => {
  const args = process.argv[2].split('=')
  if (args[0] !== 'count') {
    console.error('Expected count=NUM arg')
  }

  const count = parseInt(args[1])
  for (let i = 0; i < count; i++) {
    testClient(`CLIENT ${i}`)
  }
}

launch()
