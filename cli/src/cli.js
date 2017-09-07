import vorpal from 'vorpal'
import { words } from 'lodash'
import { connect } from 'net'
import { Message } from './Message'

export const cli = vorpal()

let username
let server

cli
  .delimiter(cli.chalk['yellow']('Enter a command: '))

cli
  .mode('connect <username> <host> <port>', 'Connects as <username> with IPv4 address <host> on port <port>')
  .delimiter(cli.chalk['green']('<connected>'))
  .init(function (args, callback) {
    username = args.username
    server = connect({ host: args.host, port: args.port }, () => {
      server.write(new Message({ username, command: 'connect' }).toJSON() + '\n')
      callback()
    })

    server.on('data', (buffer) => {
      let serverMessage = Message.fromJSON(buffer)
      switch(serverMessage.command) {
        case 'alert':
        case 'echo':
        case '@':
        case 'broadcast':
        case 'users':
        case 'disconnect':
          this.log(serverMessage.toString())
          break;
        default:
          // Some sort of error checking here
          break;
      }
    })

    server.on('end', () => {
      cli.exec('exit')
    })
  })
  .action(function (input, callback) {
    let command
    let contents
    if(input.charAt(0) !== '@') {
      const [firstWord, ...rest] = words(input)
      command = firstWord
      contents = rest.join(' ')
    } else {
      command = '@'
      const rest = input.split("")
      contents = rest.slice(1, rest.length).join('')
    }

    switch(command) {
      case 'echo':
      case 'users':
      case 'change username':
      case '@':
      case 'broadcast':
        server.write(new Message({ username, command, contents }).toJSON() + '\n')
        break;
      case 'disconnect':
        server.end(new Message({ username, command }).toJSON() + '\n')
        break;
      default:
        server.write(new Message({ username, command : 'no command', contents : (command + " " + contents) }).toJSON() + '\n')
        break;
    }

    callback()
  })

