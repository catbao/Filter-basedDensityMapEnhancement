/**
 *  Here we will check from time to time if we can access the OpenCV
 *  functions. We will return in a callback if it's been resolved
 *  well (true) or if there has been a timeout (false).
 */
function waitForOpencv(callbackFn, waitTimeMs = 30000, stepTimeMs = 100) {
  if (cv.Mat) callbackFn(true);

  let timeSpentMs = 0;
  const interval = setInterval(() => {
    const limitReached = timeSpentMs > waitTimeMs;
    if (cv.Mat || limitReached) {
      clearInterval(interval);
      return callbackFn(!limitReached);
    } else {
      timeSpentMs += stepTimeMs;
    }
  }, stepTimeMs);
}

COLORMAP_2D = null; // load from a image
current_2d_colormap = null; // may be transformed

/**
 * Choose different colormaps to display.
 */
function getColormapCode(colormap) {
  switch (colormap) {
    case "Plasma":
      return cv.COLORMAP_PLASMA;
    case "Viridis":
      return cv.COLORMAP_VIRIDIS;
    case "Inferno":
      return cv.COLORMAP_INFERNO;
    case "Turbo":
      return cv.COLORMAP_TURBO;
    case "Cividis":
      return cv.COLORMAP_CIVIDIS;
    default:
      return cv.COLORMAP_PLASMA;
  }
}

/**
 *  Rescaling a value x from an old range defined by old_min and old_max to
 *  a new range defined by new_min and new_max
 */
function minMaxScale(x, old_min, old_max, new_min, new_max) {
  X_std = (x - old_min) / (old_max - old_min);
  X_scaled = X_std * (new_max - new_min) + new_min;
  return X_scaled;
}

/**
 * Mapping real values ​​to a 2D colormap
 */
function mappingValueTo2DColorbar(input, result, { minVal, maxVal }) {
  let inputMin = Infinity,
    inputMax = -Infinity;
  input.map((row) =>
    row.map((val) => {
      if (val < inputMin) {
        inputMin = val;
      }
      if (val > inputMax) {
        inputMax = val;
      }
    })
  );

  let coloredResult = input.map((row, i) =>
    row.map((val, j) => {
      let hueIdx = Math.max(
        Math.ceil(
          minMaxScale(val, inputMin, inputMax, 0, current_2d_colormap.rows)
        ) - 1,
        0
      );
      let lightnessIdx = Math.max(
        Math.ceil(
          minMaxScale(
            result.floatAt(i, j),
            minVal,
            maxVal,
            0,
            current_2d_colormap.cols
          )
        ) - 1,
        0
      );
      return Array.from(current_2d_colormap.ucharPtr(lightnessIdx, hueIdx));
    })
  );
  return cv.matFromArray(
    result.rows,
    result.cols,
    cv.CV_8UC4,
    coloredResult.flat(2)
  );
}

/**
 * With OpenCV we have to work with the images as cv.Mat (matrices),
 * so you'll have to transform the ImageData to it.
 */
function enhanceDensityMap({
  msg,
  densitymap,
  originalData,
  paramStr,
  regionLensStr,
}) {
  let mapWidth = densitymap.length,
    mapHeight = densitymap[0].length;
  let src = cv.matFromArray(mapWidth, mapHeight, cv.CV_32F, densitymap.flat());

  let params = JSON.parse(paramStr);
  let baseLayer = new cv.Mat(),
    detailLayer = new cv.Mat(),
    result = new cv.Mat();
  //Select the type of filter to use: gaussian or guided
  switch (params.filter) {
    case "gaussian":
      let d =
          params.filterParams.win_size % 2 == 0
            ? params.filterParams.win_size + 1
            : params.filterParams.win_size,
        sigma = params.filterParams.sigma;
      cv.GaussianBlur(
        src,
        baseLayer,
        new cv.Size(d, d),
        sigma,
        sigma,
        cv.BORDER_DEFAULT
      );
      break;
    case "guided":
      guidedFilter(
        src,
        src,
        baseLayer,
        params.filterParams.win_size,
        params.filterParams.tau
      );
      break;
    default:
      throw new Error("Invalid filter type");
  }
  //substract baseLayer and detailLayer
  cv.subtract(src, baseLayer, detailLayer);
  let boostingMat = getBoostingMatrix(src, params, regionLensStr);
  cv.add(baseLayer, detailLayer.mul(boostingMat, 1), result);
  // truncate the values less than zero in the output density field I'
  // the 4th argument (maxval) is unnecessary, so pass undefined to it
  const minMaxLoc = cv.minMaxLoc(src);
  cv.threshold(result, result, minMaxLoc.minVal, undefined, cv.THRESH_TOZERO);
  const resultMinMaxLoc = cv.minMaxLoc(result);

  let dst;
  //Whether the category of the color map is 2D_CIELch
  if (params.colormap === "2D_CIELch") {
    if (current_2d_colormap == undefined) {
      current_2d_colormap = cv.matFromImageData(COLORMAP_2D);
      cv.flip(current_2d_colormap, current_2d_colormap, 0);
    }
    dst = mappingValueTo2DColorbar(originalData, result, resultMinMaxLoc);
  } else {
    dst = new cv.Mat();
    // scale to [0,255], then convert to gray scale
    cv.normalize(result, result, 0, 255, cv.NORM_MINMAX);
    result.convertTo(dst, cv.CV_8UC1);

    // colorize the density map
    if (params.colormap === "Greys") {
      cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
    } else {
      cv.applyColorMap(dst, dst, getColormapCode(params.colormap));
      cv.cvtColor(dst, dst, cv.COLOR_BGR2RGBA);
    }
  }

  // fit the display size
  cv.resize(dst, dst, new cv.Size(params.width, params.height));
  cv.flip(dst, dst, 0);
  const clampedArray = new ImageData(
    new Uint8ClampedArray(dst.data),
    dst.cols,
    dst.rows
  );
  postMessage({
    msg,
    imgData: clampedArray,
    minVal: resultMinMaxLoc.minVal,
    maxVal: resultMinMaxLoc.maxVal,
  });
  src.delete();
  dst.delete();
  baseLayer.delete();
  detailLayer.delete();
  result.delete();
  boostingMat.delete();
}

// function customKernelFunc(i,j,anchor_pos,bandwidth) {
//   let dist = (Math.abs(i-anchor_pos)+Math.abs(j-anchor_pos))/bandwidth;
//   return dist <= 1 ? Math.pow(1-Math.pow(dist, 3), 2) : 0;
// }

// function applyCustomKernel(src, dst, size, bandwidth) {
//   let anchor_pos = Math.floor(size/2),
//       kernel=[];
//   for(let i=0; i<size; ++i)
//     for(let j=0; j<size; ++j)
//         kernel.push(customKernelFunc(i,j,anchor_pos,bandwidth));

//   let sum = kernel.reduce((s,a)=>s+a, 0);
//   kernel = kernel.map(x=>x/sum);
//   kernel = cv.matFromArray(size, size, cv.CV_32F, kernel);
//   cv.filter2D(src, dst, -1, kernel);
// }

/**
 * 
Generate a enhancement matrix, then perform additional enhancement on the 
local area according to regionLens, and finally smooth the entire matrix 
through boxFilter.
 */
function getBoostingMatrix(src, params, regionLensStr) {
  let boostingMat = cv.Mat.ones(src.rows, src.cols, cv.CV_32F);
  cv.multiply(
    boostingMat,
    cv.Mat.ones(src.rows, src.cols, cv.CV_32F),
    boostingMat,
    params.detailFactor
  );

  let regionLens = JSON.parse(regionLensStr);
  for (let i = regionLens.dataMinY; i < regionLens.dataMaxY; ++i)
    for (let j = regionLens.dataMinX; j < regionLens.dataMaxX; ++j)
      boostingMat.floatPtr(i, j)[0] = regionLens.factor;

  cv.boxFilter(boostingMat, boostingMat, cv.CV_32F, new cv.Size(11, 11));
  return boostingMat;
}

/**
 * Implementation of guided filter.
 * He, Kaiming, Jian Sun, and Xiaoou Tang. "Guided image filtering." IEEE transactions on pattern analysis and machine intelligence 35.6 (2012): 1397-1409.
 */
function guidedFilter(source, guided_image, output, w, tau) {
  let guided = guided_image.clone();

  let source_32f = new cv.Mat();
  let guided_32f = new cv.Mat();
  source.convertTo(source_32f, cv.CV_32F);
  guided.convertTo(guided_32f, cv.CV_32F);

  let let_Ip = new cv.Mat();
  let let_I2 = new cv.Mat();
  cv.multiply(guided_32f, source_32f, let_Ip);
  cv.multiply(guided_32f, guided_32f, let_I2);

  let mean_p = new cv.Mat();
  let mean_I = new cv.Mat();
  let mean_Ip = new cv.Mat();
  let mean_I2 = new cv.Mat();
  let win_size = w % 2 == 0 ? new cv.Size(w + 1, w + 1) : new cv.Size(w, w);
  cv.boxFilter(source_32f, mean_p, cv.CV_32F, win_size);
  cv.boxFilter(guided_32f, mean_I, cv.CV_32F, win_size);
  cv.boxFilter(let_Ip, mean_Ip, cv.CV_32F, win_size);
  cv.boxFilter(let_I2, mean_I2, cv.CV_32F, win_size);

  let cov_Ip = new cv.Mat();
  let var_I = new cv.Mat();
  cv.subtract(mean_Ip, mean_I.mul(mean_p, 1), cov_Ip);
  cv.subtract(mean_I2, mean_I.mul(mean_I, 1), var_I);

  for (let i = 0; i < guided_image.rows; ++i)
    for (let j = 0; j < guided_image.cols; ++j) var_I.floatPtr(i, j)[0] += tau;

  let a = new cv.Mat();
  let b = new cv.Mat();
  cv.divide(cov_Ip, var_I, a);
  cv.subtract(mean_p, a.mul(mean_I, 1), b);

  let mean_a = new cv.Mat();
  let mean_b = new cv.Mat();
  cv.boxFilter(a, mean_a, cv.CV_32F, win_size);
  cv.boxFilter(b, mean_b, cv.CV_32F, win_size);
  cv.add(mean_a.mul(guided_32f, 1), mean_b, output);

  guided.delete();
  source_32f.delete();
  guided_32f.delete();
  let_Ip.delete();
  let_I2.delete();
  mean_p.delete();
  mean_I.delete();
  mean_Ip.delete();
  mean_I2.delete();
  cov_Ip.delete();
  var_I.delete();
  a.delete();
  b.delete();
  mean_a.delete();
  mean_b.delete();
}

/**
 * The adjust2DColorMap function modifies a 2D colormap by resizing specific segments
 * of it based on the provided parameters.
 */
function adjust2DColorMap({ s, e, o, n }) {
  let oldRange = [0, s, o, e, current_2d_colormap.cols],
    newRange = [0, s, n, e, current_2d_colormap.cols];
  let pieces = new cv.MatVector();
  for (let i = 0; i < 4; ++i) {
    let w = oldRange[i + 1] - oldRange[i];
    if (w > 0) {
      let piece = current_2d_colormap.roi(
        new cv.Rect(oldRange[i], 0, w, current_2d_colormap.rows)
      );
      if (i > 0 && i < 3) {
        // only resize for colors within [s,e]
        cv.resize(
          piece,
          piece,
          new cv.Size(newRange[i + 1] - newRange[i], current_2d_colormap.rows)
        );
      }
      pieces.push_back(piece);
      piece.delete();
    }
  }
  cv.hconcat(pieces, current_2d_colormap);
  pieces.delete();
}

/**
 * This exists to capture all the events that are thrown out of the worker
 * into the worker. Without this, there would be no communication possible
 * with the project.
 */
onmessage = function (e) {
  switch (e.data.msg) {
    case "load": {
      // Import Webassembly script
      self.importScripts(e.data.openCvPath);
      if (cv instanceof Promise) {
        cv.then((target) => {
          cv = target;
          // console.log(cv.getBuildInformation());
        });
      }
      waitForOpencv(function (success) {
        if (success) postMessage({ msg: e.data.msg });
        else throw new Error("Error on loading OpenCV");
      });
      break;
    }
    case "enhancing":
      enhanceDensityMap(e.data);
      break;
    case "sending2d":
      COLORMAP_2D = e.data.imgData;
      postMessage({ msg: e.data.msg });
      break;
    case "adjusting2d":
      if (e.data.locsStr) {
        adjust2DColorMap(JSON.parse(e.data.locsStr));
      }
      let clampedArray = undefined;
      if (current_2d_colormap == undefined) {
        clampedArray = COLORMAP_2D;
      } else {
        let dst = new cv.Mat();
        cv.flip(current_2d_colormap, dst, 0);
        clampedArray = new ImageData(
          new Uint8ClampedArray(dst.data),
          dst.cols,
          dst.rows
        );
        dst.delete();
      }
      postMessage({ msg: e.data.msg, bi_colormap: clampedArray });
      break;
    default:
      break;
  }
};
