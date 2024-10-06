function parseData(text: string) {
    return text.trim().split('\r\n').map(line => 
        line.split(',').map(x=>parseInt(x))
    );
}

function fetchData(src: string) {
    return fetch(src)
            .then(response => response.text())
            .then(text => parseData(text))
            .catch(err => console.log(err.message))
}

function drawImageData(canvas: HTMLCanvasElement, imgData: ImageData) {
    let ctx = canvas.getContext("2d");
    if(ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = imgData.width;
        canvas.height = imgData.height;
        ctx.putImageData(imgData, 0, 0);
    }
}

function getTransformFunction(transformType: string) {
    switch (transformType) {
        case 'linear':
            return (x:number) => x;
        case 'log':
            return Math.log1p;
        case 'pow':
            return (x:number) => Math.pow(x,2);
        case 'sqrt':
            return Math.sqrt;
        case 'cbrt':
            return Math.cbrt;
        default:
            throw new Error('Invalid tranform type');
    }
}

function getInverseTransformFunction(transformType: string) {
    switch (transformType) {
        case 'linear':
            return (x:number) => x;
        case 'log':
            return (x:number) => Math.pow(Math.E, x)-1;
        case 'pow':
            return Math.sqrt;
        case 'sqrt':
            return (x:number) => Math.pow(x,2);
        case 'cbrt':
            return (x:number) => Math.pow(x,3);
        default:
            throw new Error('Invalid tranform type');
    }
}

function getTickValues(minVal: number, maxVal: number, transfromFunc: (x:number) => number) {
    let interval = maxVal - minVal, base = 1;
    while(interval/base > 10) { base *= 10; }
    let tickValues = [], start = Math.ceil(minVal/base);
    for(let i=start, end = Math.ceil(maxVal/base); i<end; ++i) {
        tickValues.push(i*base);
    }
    if(tickValues[0] > minVal) { tickValues.unshift(minVal); }
        let transformed = [minVal,tickValues[1],tickValues[tickValues.length-1],maxVal].map(transfromFunc);
        if(tickValues[tickValues.length-1] < maxVal && (transformed[3]-transformed[2])/(transformed[3]-transformed[0]) > 0.02) {
        tickValues.push(maxVal);
    }
    if(base > 1 && (transformed[1]-transformed[0])/(transformed[3]-transformed[0]) > 0.5) { // not enough ticks for smaller values
        base /= 10;
        start = Math.ceil(tickValues[1]/base)-1;
        for(let i=start, end = Math.ceil(minVal/base); i>end; --i) {
            tickValues.push(i*base);
        }
    }
    return tickValues;
}

import { interpolatePlasma, interpolateInferno, interpolateCividis, interpolateViridis, interpolateTurbo, interpolateGreys } from 'd3-scale-chromatic'

function getInterpolateFunc(colormap: string) {
    switch (colormap) {
        case 'Plamsa':
            return interpolatePlasma;
        case 'Viridis':
            return interpolateViridis;
        case 'Inferno':
            return interpolateInferno;
        case 'Turbo':
            return interpolateTurbo;
        case 'Cividis':
            return interpolateCividis;
        case 'Greys':
            return (t:number) => interpolateGreys(1-t);
        default:
            return interpolatePlasma;
    }
}

function extent(data: number[][]) {
    let minVal = Infinity, maxVal = -Infinity;
    data.map(row => {
        row.map(val => {
            if (val < minVal) { minVal = val; }
            if (val > maxVal) { maxVal = val; }
        })
    });
    return [minVal, maxVal];
}

import type DensityMapViewerVue from './components/DensityMapViewer.vue';

function translateBottomLeftPosition(x: number, y: number, viewer: typeof DensityMapViewerVue) {
    let relativeX = Math.round(x/viewer.params.width*viewer.level0_Width),
        relativeY = Math.round((1-y/viewer.params.height)*viewer.level0_Height);
    let zoomRatio = Math.pow(2, viewer.zoomLevel-viewer.previousZoomLevel),
        zoomedCenterX = (viewer.bottomLeftPosition[0]+relativeX) * zoomRatio,
        zoomedCenterY = (viewer.bottomLeftPosition[1]+relativeY) * zoomRatio;

    function value_limit(val:number, lowerBound:number, upperBound: number) {
        return val<lowerBound ? lowerBound : val>upperBound ? upperBound : val;
    }
    let halfW = viewer.level0_Width/2, halfH = viewer.level0_Height/2,
        sizeRatio = Math.pow(2, viewer.zoomLevel),
        zoomedLeftX = value_limit(zoomedCenterX-halfW, 0, viewer.level0_Width*(sizeRatio-1)),
        zoomedBottomY = value_limit(zoomedCenterY-halfH, 0, viewer.level0_Height*(sizeRatio-1));
    viewer.bottomLeftPosition[0] = zoomedLeftX;
    viewer.bottomLeftPosition[1] = zoomedBottomY;
}

export default {
    fetchData,
    drawImageData,
    getTransformFunction,
    getTickValues,
    getInverseTransformFunction,
    getInterpolateFunc,
    extent,
    translateBottomLeftPosition
};