import vorpal from 'vorpal'
import { words } from 'lodash'
import { connect } from 'net'
import { Message } from './Message'

export const cli = vorpal()

let getCurrentTime = function() {
  let date = new Date()
  let hours = date.getHours()
  let minutes = date.getMinutes()
  let seconds = date.getSeconds()
  let timeBuilder = ""

  if(hours > 12) {
    if((hours - 12) < 10) {
      timeBuilder += "0" + (hours - 12)
    }
  } else {
    if((hours) < 10) {
      timeBuilder += "0" + hours
    }
  }

  if(minutes < 10) {
    timeBuilder += ":0" + minutes
  } else {
    timeBuilder += ":" + minutes
  }

  if(seconds < 10) {
    timeBuilder += ":0" + seconds
  } else {
    timeBuilder += ":" + seconds
  }

  if(hours >= 12) {
    timeBuilder += ":PM"
  } else {
    timeBuilder += ":AM"
  }

  return timeBuilder
}

let outputBuilderFunc = (command, serverMessage) => {
  return `${cli.chalk.red.underline(getCurrentTime())} ${cli.chalk.white(`<${serverMessage.username}> ${cli.chalk.green(command)}`)} ` + 
    cli.chalk.white(eval('`' + serverMessage.toString() + '`'))
}

let username
let server
let previousCommand = ''

cli
  .delimiter(cli.chalk.bold.blue('Enter connection details :'))

cli
  .mode('connect <username> <host> <port>', 'Connects as <username> with IPv4 address <host> on port <port>')
  .delimiter(cli.chalk['gray'](':'))
  .init(function (args, callback) {
    username = args.username
    server = connect({ host: args.host, port: args.port }, () => {
      server.write(new Message({ username, command: 'connect' }).toJSON() + '\n')
      callback()
    })
    cli.delimiter((`${cli.chalk.green('(Connected)')} ${cli.chalk.yellow('Enter a command')}`))

    server.on('data', (buffer) => {
      let serverMessage = Message.fromJSON(buffer)
      let outputBuilder = ''
      switch(serverMessage.command) {
        case '@':
          this.log(outputBuilderFunc(`(whisper) ${cli.chalk.gray(':')}`, serverMessage))
          break
        case 'alert':
          this.log(outputBuilderFunc('has connected', serverMessage))
          break
        case 'echo':
          this.log(outputBuilderFunc(`(echo) ${cli.chalk.gray(':')}`, serverMessage))
          break
        case 'broadcast':
          this.log(outputBuilderFunc(`(all) ${cli.chalk.gray(':')}`, serverMessage))
          break
        case 'disconnect':
        case 'exit':
        case 'quit':
          this.log(outputBuilderFunc('has disconnected', serverMessage))
        case 'users':
        default:
          this.log(cli.chalk.white(eval('`' + serverMessage.toString() + '`')))
          break
      }
    })

    server.on('end', () => {
      cli.delimiter(cli.chalk.bold.blue('\nEnter connection details :'))
      cli.exec('exitVorp')
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
      const rest = input.split('')
      const indexOfSpace = rest.findIndex(element => element === ' ')

      if(indexOfSpace !== -1) {
        previousCommand = rest.slice(0, indexOfSpace).join('')
      } else {
        previousCommand = rest.slice(0, rest.length).join('')
      }

      contents = rest.slice(1, rest.length).join('')
    }

    switch(command) {
      case 'echo':
      case 'broadcast':
        previousCommand = command
        cli.delimiter(cli.chalk.yellow(`Using command `) + cli.chalk.green(`(${command})`))
        server.write(new Message({ username, command, contents }).toJSON() + '\n')
        break
      case '@':
        cli.delimiter(cli.chalk.yellow(`Using command `) + cli.chalk.green(`(${previousCommand})`))
        server.write(new Message({ username, command, contents }).toJSON() + '\n')
        break
      case 'users':
        server.write(new Message({ username, command, contents }).toJSON() + '\n')
        break
      case 'disconnect':
      case 'exit':
      case 'quit':
        cli.log(cli.chalk['red']('Disconnecting...\n'))
        cli.delimiter(cli.chalk.bold.gray('Successfully Disconnected'))
        server.end(new Message({ username, command }).toJSON() + '\n')
        break
      default:
        if(previousCommand === '') {
          cli.delimiter((`${cli.chalk.green('<Connected>')} ${cli.chalk.yellow('Enter a command')}`))
        } else {
          cli.delimiter(cli.chalk.yellow(`Using command `) + cli.chalk.green(`(${previousCommand})`))
        }
        server.write(new Message({ username, command : 'default', contents : (command + " " + contents) }).toJSON() + '\n')
        break
    }
    callback()
  })
