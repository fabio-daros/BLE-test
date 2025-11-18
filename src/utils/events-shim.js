// src/utils/events-shim.js
// Shim para módulo 'events' usado pelo Firebase Phone Auth
// EventEmitter não existe nativamente no React Native

class EventEmitter {
  constructor() {
    this._events = {};
  }

  on(event, listener) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(listener);
    return this;
  }

  once(event, listener) {
    const onceWrapper = (...args) => {
      this.removeListener(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  emit(event, ...args) {
    if (this._events[event]) {
      this._events[event].forEach(listener => listener(...args));
    }
    return this;
  }

  removeListener(event, listener) {
    if (this._events[event]) {
      this._events[event] = this._events[event].filter(l => l !== listener);
    }
    return this;
  }

  removeAllListeners(event) {
    if (event) {
      delete this._events[event];
    } else {
      this._events = {};
    }
    return this;
  }

  listeners(event) {
    return this._events[event] || [];
  }

  listenerCount(event) {
    return this.listeners(event).length;
  }
}

// Exportar EventEmitter de múltiplas formas para compatibilidade
// Exportar como função diretamente
module.exports = EventEmitter;
// Exportar como propriedade também
module.exports.EventEmitter = EventEmitter;
// Exportar como default
module.exports.default = EventEmitter;
// Garantir que .EventEmitter exista mesmo quando usado como função
if (typeof EventEmitter !== 'undefined') {
  EventEmitter.EventEmitter = EventEmitter;
}

