import utils from '@/utils'

class CV {
  /**
   * We will use this method privately to communicate with the worker and
   * return a promise with the result of the event. This way we can call
   * the worker asynchronously.
   */
  _dispatch(event) {
    // if the _status property exists, there is an incomplete task
    // wait until that task finishes
    if (this._status) {
      return new Promise((res, rej) => {
        setTimeout(ev => this._dispatch(ev).then(res).catch(rej), 100, event);
      });
    }

    this._status = ['loading']
    this.worker.postMessage(event)
    return new Promise((res, rej) => {
      let interval = setInterval(() => {
        const status = this._status
        if (!status) {
          rej(new Error('tasks conflict'))
          clearInterval(interval)
          return;
        }
        if (status[0] === 'done') res(status[1])
        if (status[0] === 'error') rej(status[1])
        if (status[0] !== 'loading') {
          delete this._status
          clearInterval(interval)
        }
      }, 50)
    })
  }

  /**
   * First, we will load the worker and capture the onmessage
   * and onerror events to always know the status of the event
   * we have triggered.
   *
   * Then, we are going to call the 'load' event, as we've just
   * implemented it so that the worker can capture it.
   */
  load() {
    // avoid duplication of workers
    if(this.worker) { return new Promise(res => res()); }
    const prefix = import.meta.url.includes('src') ? '/src' : '';
    this.worker = new Worker(`${prefix}/assets/worker/cv.worker.js`) // load worker
    this.load2DColormap(prefix);

    // Capture events and save [status, event] inside the _status object
    this.worker.onmessage = e => this._status = ['done', e]
    this.worker.onerror = e => this._status = ['error', e]
    return this._dispatch({ msg: 'load', openCvPath: `${prefix}/assets/worker/opencv.js` })
  }

  /**
   * apply the user-specified filter to the given density map
   */
  enhanceDensityMap(array_2d, params, regionLens) {
    // 2d colormap is loaded ? continuing : waiting until loaded
    let paramStr = JSON.stringify(params);
    let regionLensStr = JSON.stringify(regionLens);
    let tmpData = array_2d.map(row => {
      return row.map(utils.getTransformFunction(params.type))
    });
    let originalData = params.colormap.startsWith('2D') ? toRaw(array_2d) : undefined;
    return this._dispatch({msg: 'enhancing', densitymap: tmpData, originalData, paramStr, regionLensStr })
  }

  load2DColormap(prefix) {
    let w = 300, h = 300;
    const canvas = document.getElementById("2d_colormap");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    const img = new Image();
    console.log('load 2d colormap')
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      this._dispatch({msg: 'sending2d', imgData: ctx.getImageData(0,0,w,h)})
    };
    img.src = `${prefix}/assets/2d_colormap.png`
  }

  redraw2DColormap(locsStr) {
    return this._dispatch({msg: 'adjusting2d', locsStr});
  }
}

// Export the same instant everywhere
export default new CV()