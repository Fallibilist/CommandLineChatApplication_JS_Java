import vorpal from 'vorpal'
import { words } from 'lodash'
import { connect } from 'net'
import { Message } from './Message'

export const cli = vorpal()

// This function returns the current time in a formatted string
let getCurrentTime = () => {
  let date = new Date()
  let hours = date.getHours()
  let minutes = date.getMinutes()
  let seconds = date.getSeconds()
  let timeBuilder = ""

  if(hours > 12) {
    if((hours - 12) < 10) {
      timeBuilder += "0" + (hours - 12)
    } else {
      timeBuilder += (hours - 12)
    }
  } else {
    if((hours) < 10) {
      timeBuilder += "0" + hours
    } else {
      timeBuilder += hours
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
    timeBuilder += " PM"
  } else {
    timeBuilder += " AM"
  }

  return timeBuilder
}

// This parses the information recieved from the serve and outputs it in the correct formatting
let outputBuilderFunc = (command, messageUsername, messageContents) => {
  return `${cli.chalk.cyan.bold(getCurrentTime())} ${cli.chalk.white(`<${messageUsername}>`)} ${cli.chalk.green(command)}` +  messageContents
}

// The CLI output menu post connection
let helpOutputFunc = () => {
  return `${cli.chalk.green('\n   Commands: ')}` +
    `${cli.chalk.cyan.bold('\n     echo <message>          :    Sends your message back to you')}` +
      `${cli.chalk.white('\n     broadcast <message>     :    Sends your message to all connected users')}` +
        `${cli.chalk.gray('\n     @<username> <message>   :    Sends a whisper the the user specified')}` +
          `${cli.chalk.blue('\n     users                   :    Displays a list of all connected users')}` +
            `${cli.chalk.red.bold('\n     disconnect              ')}` +
              `${cli.chalk.red.bold('\n        exit                 ')}` +
                `${cli.chalk.red.bold('\n           quit              :    All close your connection to the server\n')}`
}

let username
let server
let previousCommand = ''

// Initial welcoming and instructions for user
cli.log(`${cli.chalk.blue('       Welcome')} To ` + 
          `${cli.chalk.bold.green("Greg's")} ` + 
            `${cli.chalk.cyan.bold('Incredibly')} ` + 
              `${cli.chalk.white('Exciting')} ` + 
                `${cli.chalk.gray('Chat')} ` + 
                  `${cli.chalk.blue('Application')}` +
                    `${cli.chalk.green('!\n')}`)

cli.log(cli.chalk.green.dim("              Let's start by connecting to the server!"))
cli.log(cli.chalk.cyan.bold.dim('               Type connect <username> <host> <port>\n'))

cli
  .delimiter(cli.chalk.italic.bold.yellow('Enter connection details :'))

cli
  .mode('connect <username> <host> <port>', 'Connects as <username> with IPv4 address <host> on port <port>')
  .delimiter(cli.chalk['gray'](':'))
  .init(function (args, callback) {
    username = args.username
    server = connect({ host: args.host, port: args.port }, () => {
      server.write(new Message({ username, command: 'connect' }).toJSON() + '\n')
      callback()
    })

    // When the server disconnects this handles the exception and closes the clientside connection
    server.on('error', function(ex) {
      console.log("No Server Found! Please Run The Server!");
      cli.delimiter(cli.chalk.bold.yellow('\nEnter connection details :'))
      cli.exec('exitVorp')
    });

    // Outputs the color key to the CLI
    server.on('connect', function(ex) {
      cli.log(`${cli.chalk.green('\nC')}` + 
                `${cli.chalk.blue('o')}` + 
                  `${cli.chalk.yellow('l')}` + 
                    `${cli.chalk.white('o')}` + 
                      `${cli.chalk.bold.cyan('r ')}` + 
                        `${cli.chalk.green('K')}` + 
                          `${cli.chalk.bold.red('e')}` + 
                            `${cli.chalk.yellow('y')}` + 
                              `${cli.chalk.white(':')}` + 
              `${cli.chalk.blue('\n   Blue   : User Input')}` + 
                `${cli.chalk.green('\n   Green  : Commands')}` + 
                  `${cli.chalk.gray('\n   Gray   : Direct Messages')}` + 
                    `${cli.chalk.yellow('\n   Yellow : Instructions')}` + 
                      `${cli.chalk.white('\n   White  : Broadcasts and Names')}` + 
                        `${cli.chalk.bold.cyan('\n   Cyan   : Timestamps and Echoes\n   ')}` + 
                          `${cli.chalk.red.underline('Red    : Errors and Disconnections')}` +
                            `${cli.chalk.yellow.bold('\n\n   <Type HELP For Commands>\n')}`)
    });

    // Sets the initial delimiter following connection
    cli.delimiter((`${cli.chalk.green('(Connected)')} ${cli.chalk.yellow('Enter a command')}`))

    // Recieves data from the server
    server.on('data', (buffer) => {
      let serverMessage = Message.fromJSON(buffer)
      let outputBuilder = ''
      switch(serverMessage.command) {
        case 'help':
          this.log(serverMessage.toString())
          break
        case '@':
          this.log(outputBuilderFunc(`(whisper) ${cli.chalk.gray(': ')}`, serverMessage.username, cli.chalk.gray(serverMessage.toString())))
          break
        case 'alert':
          username = serverMessage.username
          this.log(outputBuilderFunc(cli.chalk.red.bold('has connected'), serverMessage.username, cli.chalk.red.bold(serverMessage.toString())))
          break
        case 'echo':
          this.log(outputBuilderFunc(`(echo) ${cli.chalk.gray(': ')}`, serverMessage.username, cli.chalk.cyan(serverMessage.toString())))
          break
        case 'broadcast':
          this.log(outputBuilderFunc(`(all) ${cli.chalk.gray(': ')}`, serverMessage.username, cli.chalk.white(serverMessage.toString())))
          break
        case 'disconnect':
        case 'exit':
        case 'quit':
          this.log(outputBuilderFunc(cli.chalk.red.bold('has disconnected'), serverMessage.username, serverMessage.toString()))
        case 'users':
          this.log(cli.chalk.white(eval('`' + serverMessage.toString() + '`')))
          break
        case 'error':
          previousCommand = ''
          cli.ui.delimiter((`${cli.chalk.green('<Connected>')} ${cli.chalk.yellow('Enter a command : ')}`))
          this.log(cli.chalk.red.underline(eval('`' + serverMessage.toString() + '`')))
          break
        default:
          this.log(cli.chalk.red.underline(eval('`' + serverMessage.toString() + '`')))
          break
      }
    })

    server.on('end', () => {
      cli.delimiter(cli.chalk.bold.yellow('\nEnter connection details :'))
      cli.exec('exitVorp')
    })
  })
  .action(function (input, callback) {
    let command
    let contents

    // Parses the incoming messages
    if(input.charAt(0) !== '@') {
      const [firstWord, ...rest] = input.split(' ')
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
      
    // Sends messages to the server to handle
    switch(command) {
      case 'HELP':
      case 'Help':
      case 'help':
        server.write(new Message({ username, command : 'help', contents : helpOutputFunc() }).toJSON() + '\n')
        break
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
        cli.log(cli.chalk.bold.red('Disconnecting...\n'))
        cli.delimiter(cli.chalk.bold.gray('Successfully Disconnected'))
        server.end(new Message({ username, command }).toJSON() + '\n')
        break
      default:
        if(previousCommand === '') {
          cli.delimiter((`${cli.chalk.green('<Connected>')} ${cli.chalk.yellow('Enter a command')}`))
          server.write(new Message({ username, command : 'error', contents : ('Illegal Command or Unknown Recipient: ' + (command + ' ' + contents)) }).toJSON() + '\n')
        } else {
          cli.delimiter(cli.chalk.yellow(`Using command `) + cli.chalk.green(`(${previousCommand})`))
          server.write(new Message({ username, command : 'default', contents : (command + " " + contents) }).toJSON() + '\n')
        }
        break
    }

    callback()
  })
