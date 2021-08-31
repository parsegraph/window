import {AnimationTimer, TimeoutTimer, elapsed} from 'parsegraph-timing';

import Method from 'parsegraph-method';

import Window from './GraphicsWindow';

// Whether idle loops are limited to being called only as
// often as parsegraph_INTERVAL.
export const GOVERNOR = true;

// Where the idle loop is called multiple times per frame if time remains.
export const BURST_IDLE = false;

// How long painting is done, and optionally, how fast idle loops will render.
export const INTERVAL = 15;

// Amount of time, in milliseconds, reserved for idling.
export const IDLE_MARGIN = 1;

export default class TimingBelt {
  _windows:Window[];

  _burstIdle:boolean;
  _lastIdle:Date;
  _idleJobs:Method[];
  _renderTimer:AnimationTimer;
  _governor:boolean;
  _interval:number;
  _idleTimer:TimeoutTimer;
  _lastRender:Date;

  constructor() {
    this._windows = [];

    this._idleJobs = [];
    this._renderTimer = new AnimationTimer();
    this._renderTimer.setListener(this.cycle, this);

    this._governor = GOVERNOR;
    this._burstIdle = BURST_IDLE;
    this._lastIdle = null;
    this._interval = INTERVAL;
    this._idleTimer = new TimeoutTimer();
    this._idleTimer.setDelay(INTERVAL);
    this._idleTimer.setListener(this.onIdleTimer, this);
    this._idleTimer.schedule();

    this._lastRender = null;
  }

onIdleTimer() {
  this.idle(INTERVAL - IDLE_MARGIN);
};

addWindow(window:Window) {
  this._windows.push(window);
  window.setOnScheduleUpdate(this.scheduleUpdate, this);
  this.scheduleUpdate();
};

removeWindow(window:Window) {
  for (let i = 0; i < this._windows.length; ++i) {
    if (this._windows[i] === window) {
      this._windows.splice(i, 1);
      window.setOnScheduleUpdate(null, null);
      return true;
    }
  }
  return false;
};

/**
 * Sets whether idle loops are limited to being called only as
 * often as the configured interval.
 *
 * @param {boolean} governor if true, idle function invocations are throttled to the interval
 */
setGovernor(governor:boolean):void {
  this._governor = governor;
};

/**
 * Whether the idle loop is called multiple times per frame if time remains.
 *
 * @param {boolean} burstIdle if true, the idle loop can be called multiple times per frame
 */
setBurstIdle(burstIdle:boolean):void {
  this._burstIdle = burstIdle;
};

/**
 * How long painting is done, and optionally, how fast idle loops will render.
 *
 * @param {number} interval number of milliseconds to run a single cycle.
 */
setInterval(interval:number):void {
  this._interval = interval;
};

queueJob(jobFunc:Function, jobFuncThisArg?:any):void {
  this._idleJobs.push(new Method(jobFunc, jobFuncThisArg));
  this.scheduleUpdate();
};

idle(interval:number):void {
  if (this._idleJobs.length === 0) {
    // ("Nothing to idle");
    return;
  }
  const startTime = new Date();
  if (
    interval > 0 &&
    elapsed(startTime) < interval &&
    (!this._governor || !this._lastIdle || elapsed(this._lastIdle) > interval)
  ) {
    // alert("Idle looping");
    do {
      // log("Idling");
      const job = this._idleJobs[0];
      let r;
      try {
        r = job.call(interval - elapsed(startTime));
      } catch (ex) {
        this._idleJobs.shift();
        this.scheduleUpdate();
        alert('Idle threw: ' + ex);
        throw ex;
      }
      if (r !== true) {
        // alert("Idle complete");
        this._idleJobs.shift();
      } else {
        this.scheduleUpdate();
      }
    } while (
      this._burstIdle &&
      interval - elapsed(startTime) > 0 &&
      this._idleJobs.length > 0
    );
    if (this._idleJobs.length > 0 && this._governor) {
      this._lastIdle = new Date();
    }
  } else if (this._idleJobs.length > 0) {
    if (elapsed(startTime) >= interval) {
      alert(
          'Idle suppressed because there is no' +
          ' remaining time in the render loop.',
      );
    } else if (
      this._governor &&
      this._lastIdle &&
      elapsed(this._lastIdle) > interval
    ) {
      alert('Idle suppressed because the last idle was too recent.');
    }
  }
};

runTicks(startTime:Date) {
  let inputChangedScene = false;
  let window;
  for (let i = 0; i < this._windows.length; ++i) {
    window = this._windows[i];
    window.clearLog();
    inputChangedScene = window.tick(startTime) || inputChangedScene;
    window.log('Running timing belt. inputchangedscene=' + inputChangedScene);
  }
  return inputChangedScene;
}

doCycle() {
  const startTime = new Date();

  // Update all input functions.
  const inputChangedScene = this.runTicks(startTime);

  const interval = this._interval;
  const windowInterval = Math.max(
      0,
      (interval - elapsed(startTime)) / this._windows.length,
  );
  let needsUpdate = false;
  const windowOffset = Math.floor(Math.random() % this._windows.length);
  let window;
  if (inputChangedScene) {
    // console.log("Render and paint");
    for (let i = 0; i < this._windows.length; ++i) {
      window = this._windows[(windowOffset + i) % this._windows.length];
      if (i === 0) {
        window.log('Render and paint');
      }
      // Eagerly retrieve the GL context since this
      // can take a while on first attempt.
      window.gl();
      if (elapsed(startTime) > interval) {
        window.log('Timeout');
        needsUpdate = true;
        break;
      }
      needsUpdate = window.render() || needsUpdate;
      if (elapsed(startTime) > interval) {
        window.log('Timeout');
        needsUpdate = true;
        break;
      }
      needsUpdate = window.paint(windowInterval) || needsUpdate;
      window.log('NeedsUpdate=' + needsUpdate);
    }
  } else {
    for (let i = 0; i < this._windows.length; ++i) {
      window = this._windows[(windowOffset + i) % this._windows.length];
      if (i === 0) {
        window.log('Paint and render');
      }
      if (elapsed(startTime) > interval) {
        window.log('Timeout');
        needsUpdate = true;
        break;
      }
      needsUpdate = window.paint(windowInterval) || needsUpdate;
      if (elapsed(startTime) > interval) {
        window.log('Timeout');
        needsUpdate = true;
        break;
      }
      needsUpdate = window.render() || needsUpdate;
      window.log('NeedsUpdate=' + needsUpdate);
    }
  }

  // Run the idle function if possible.
  if (this._idleJobs.length > 0 && !needsUpdate) {
    this._idleTimer.schedule();
  } else if (window) {
    window.log('Can\'t idle: ' + this._idleJobs.length + ', ' + needsUpdate);
  }

  // Determine whether an additional cycle should automatically be scheduled.
  if (needsUpdate || inputChangedScene) {
    this.scheduleUpdate();
  }
  this._lastRender = new Date();
  if (window) {
    window.log(
        'Done rendering in ' + elapsed(startTime, this._lastRender) + 'ms',
    );
  }
};

cycle() {
  // Update all input functions.
  for (let i = 0; i < this._windows.length; ++i) {
    const window = this._windows[i];
    window.clearLog();
  }

  try {
    this.doCycle();
  } finally {
    for (let i = 0; i < this._windows.length; ++i) {
      const window = this._windows[i];
      window.finalizeLog();
    }
  }
};

scheduleUpdate() {
  // console.log("TimingBelt is scheduling update");
  return this._renderTimer.schedule();
};

}

