export default class TouchRecord {
  identifier: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  touchstart: number;

  constructor(
    id: number,
    x: number,
    y: number,
    startX: number,
    startY: number
  ) {
    this.identifier = id;
    this.x = x;
    this.y = y;
    this.startX = startX;
    this.startY = startY;
    this.touchstart = null;
  }
}
