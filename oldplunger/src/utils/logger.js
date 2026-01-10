// Code from Vencord

export class Logger {
  constructor(name, color = 'white') {
    this.name = name;
    this.color = color;
  }

  #log(level, levelColor, args) {
    console[level](
      `%c Oldcord %c Oldplunger %c %c ${this.name} `,
      `background: #1f6ad3; color: white; font-weight: 600; border-top-left-radius: 5px; border-bottom-left-radius: 5px;`,
      `background: ${levelColor}; color: black; font-weight: 600; border-top-right-radius: 5px; border-bottom-right-radius: 5px;`,
      '',
      `background: ${this.color}; color: black; font-weight: 600; border-radius: 5px;`,
      ...args,
    );
  }

  log(...args) {
    this.#log('log', '#12ba2b', args);
  }

  info(...args) {
    this.#log('info', '#12ba2b', args);
  }

  error(...args) {
    this.#log('error', '#e00041', args);
  }

  warn(...args) {
    this.#log('warn', '#d9d11e', args);
  }

  debug(...args) {
    this.#log('debug', '#db7414', args);
  }
}
