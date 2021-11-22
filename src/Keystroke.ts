const properKeyCodes: { [id: string]: string } = {
  13: "Enter",
  27: "Escape",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
};

const directKeyNames: string[] = [
  "Enter",
  "Escape",
  "ArrowLeft",
  "ArrowUp",
  "ArrowRight",
  "ArrowDown",
  "PageDown",
  "PageUp",
  "Home",
  "End",
];

const mappedKeyNames: { [id: string]: string } = {
  "-": "ZoomIn",
  _: "ZoomIn",
  "+": "ZoomOut",
  "=": "ZoomOut",
};

export function getproperkeyname(keyName: string, keyCode: string) {
  console.log(keyName + " " + keyCode);
  if (directKeyNames.indexOf(keyName) >= 0) {
    return keyName;
  }
  return mappedKeyNames[keyName] || properKeyCodes[keyCode] || keyName;
}

export default class Keystroke {
  _key: string;
  _code: string;
  _shiftKey: boolean;
  _ctrlKey: boolean;
  _x: number;
  _y: number;

  static fromKeyboardEvent(
    event: KeyboardEvent,
    x: number,
    y: number
  ): Keystroke {
    return new Keystroke(
      event.key,
      event.code,
      x,
      y,
      event.shiftKey,
      event.ctrlKey
    );
  }

  constructor(
    keyName: string,
    keyCode: string,
    x: number,
    y: number,
    shiftKey: boolean,
    ctrlKey: boolean
  ) {
    this._key = keyName;
    this._code = keyCode;
    this._x = x;
    this._y = y;
    this._shiftKey = shiftKey;
    this._ctrlKey = ctrlKey;
  }

  x() {
    return this._x;
  }

  y() {
    return this._y;
  }

  shiftKey(): boolean {
    return this._shiftKey;
  }

  ctrlKey(): boolean {
    return this._ctrlKey;
  }

  name(): string {
    return getproperkeyname(this._key, this._code);
  }

  key(): string {
    return this._key;
  }

  code(): string {
    return this._code;
  }
}
