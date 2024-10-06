<script lang="ts">
import cv from '@/cv'
import { colorbarV } from '@/colorbar'
import utils from '@/utils'

import { select, selectAll } from 'd3-selection'
import { scaleLinear, scaleSequential } from 'd3-scale'
import { brush } from 'd3-brush'
import { debounce, throttle } from 'lodash-es'
import { ElLoading } from 'element-plus'
import { axisBottom, axisRight } from 'd3-axis'
import { interpolateSinebow } from 'd3-scale-chromatic'
import { drag } from 'd3-drag'

// global variables
let _valueBrush:any = undefined;
let _regionBrush:any = undefined;
let dataBeingDisplayed:number[][] = [[]];
let lastControlPointsLocs = [0, 75, 150, 225, 300];

export default {
  props: ['params'],
  data() {
    return {
      datasetName: '',
      zoomLevel: 0,
      maxZoomLevel: 2,
      previousZoomLevel: 0,
      level0_Width: 256,
      level0_Height: 256,
      bottomLeftPosition: [0, 0], // y axis is filpped, so bottom is 0
      isPanning: false,
      previousMousePos: [0, 0],
      multiscaleData: new Map(),
      isLensMode: true,
      is2DColorMap: false,
      controlPointsLocs: [0, 75, 150, 225, 300],
      regionLensFactor: 0,
      tableData: [] as any[],
    }
  },
  methods: {
    createDensityMapWithNewParams() {
      if(this.params.dataset === undefined) {
        console.log('is empty');
        return;
      } else if (this.params.dataset !== this.datasetName) {
        this.datasetName = this.params.dataset;
        let dataSrc = '/datasets/' + this.datasetName;
        utils.fetchData(dataSrc + '_256x256.csv')
          .then(data => {
            if(!data) {throw new Error('undefined data');}

            this.multiscaleData.set(0, data);
            // console.log(data);
            dataBeingDisplayed = data;
            this.renderDensityMapAndColorbar(data);
          });
        for (let i = this.maxZoomLevel; i>0; --i) {
          let w = Math.pow(2, 8+i);
          utils.fetchData(`${dataSrc}_${w}x${w}.csv`)
            .then(data => {
              if(data !== undefined && data.length === w)
                this.multiscaleData.set(i, data);
            });
        }
      } else { // data has been loaded
        dataBeingDisplayed = this.multiscaleData.get(0);
        this.renderDensityMapAndColorbar(dataBeingDisplayed);
      }
      this.zoomLevel = 0; // reset zoom level
      select('.zoomSlider').style('width', `${this.params.width-150}px`);

      let leftOffset = (document.getElementById('densitymap')?.offsetLeft as number)+Number(this.params.width)+20,
          colormap_canvas = document.getElementById('2d_colormap') as HTMLCanvasElement;
      colormap_canvas.style.left = `${leftOffset}px`;
      if(colormap_canvas.width != 300 || colormap_canvas.height != 300) { // colormap canvas is empty
        this.controlPointsLocs = [0, 75, 150, 225, 300];
        cv.redraw2DColormap()
          .then(e => {
            utils.drawImageData(colormap_canvas, e.data.bi_colormap);
          })
          .catch(e => { console.log(e.message); })
      }
      // only take effect in lens mode
      select('#mapBrushLayer').attr('width', this.params.width).attr('height', this.params.height); 
      select('#lensRecords').style('top', `${Number(this.params.height)+200}px`);
    },
    createRegionLensBrush() {
      let mapBrushLayer = select('.el-main').append('svg')
                        .attr('class', 'brush')
                        .attr('id', 'mapBrushLayer')
                        .attr('width', this.params.width)
                        .attr('height', this.params.height)
                        .style('position', 'absolute').lower();
      _regionBrush = brush()
        .extent([[0,0],[this.params.width,this.params.height]])
        .on('end', ({selection}) => {
          let index = this.tableData.findIndex((i:any)=>i.type=='Region lens');
          if (selection) { // top left and bottom right corners
            let regionLensInfo = {
              type: 'Region lens',
              range: JSON.stringify(selection.map((row:number[])=>row.map(Math.round))),
              factor: index !== -1 ? this.tableData[index].factor : this.regionLensFactor,
            };
            if (index === -1) { this.tableData.push(regionLensInfo); }
            else { this.tableData[index] = regionLensInfo; }
            this.regionLensFactor = regionLensInfo.factor;
          }
          else {
            if (index !== -1) { this.tableData.splice(index, 1); }
          }
          this.renderDensityMap(dataBeingDisplayed, this.params);
        });
      mapBrushLayer.append('g')
        .call(_regionBrush);
    },
    renderDensityMap(data: number[][], params: any) {
      let regionLensInfo = this.tableData.find((i:any)=>i.type=='Region lens'), regionLens:any;
      if (regionLensInfo) {
        let range = JSON.parse(regionLensInfo.range);
        regionLens = {
          dataMinX: Math.round(range[0][0]/this.params.width*this.level0_Width),
          dataMinY: Math.round((1-range[1][1]/this.params.height)*this.level0_Height),
          dataMaxX: Math.round(range[1][0]/this.params.width*this.level0_Width),
          dataMaxY: Math.round((1-range[0][1]/this.params.height)*this.level0_Height),
          factor: Number(regionLensInfo.factor)
        };
      }
      else { regionLens = { dataMinX:-1,dataMinY:-1,dataMaxX:-1,dataMaxY:-1,factor:0 } }

      let canvas = document.getElementById('densitymap') as HTMLCanvasElement;
      cv.enhanceDensityMap(data, params, regionLens)
        .then(e => {
          utils.drawImageData(canvas, e.data.imgData);
          if(params.colormap.startsWith('2D')) {
            // draw y axis
            let grV = select("#colorbar").select("g"),
                colorbarWidth = (document.getElementById('2d_colormap') as HTMLCanvasElement).width;
            let yLinearScale = scaleLinear().domain([e.data.minVal, e.data.maxVal]).range([colorbarWidth, 0]),
                yAxis = axisRight(yLinearScale);
            grV.append("g")
                    .attr("class", "colorbar axis")
                    .attr("transform", `translate(${colorbarWidth},0)`).call(yAxis);
          }
        })
        .catch(e => { console.log(e.message); })
    },
    renderDensityMapAndColorbar(data: number[][], params?: object) {
      let tmpParams = params ? params : this.params;

      this.renderDensityMap(data, tmpParams);
      this.generateColorbar(data, tmpParams);
    },
    generateColorbar(data: number[][], params: any) {
      if(this.params.colormap === undefined) { return; }

      select('#colorbar').selectAll('g').remove();
      let svg = select("#colorbar")
                .attr('height', this.params.height);
      let grV = svg.append("g");
      let colorbarWidth = 20, colorbarHeight = this.params.height-40;
      const [minVal, maxVal] = utils.extent(data);

      if(params.colormap.startsWith('2D')) {
        colorbarWidth = 300;
        svg.attr("width", colorbarWidth+100);
        grV.attr("transform", "translate(20,40)");

        // draw 2d colorbar and control points
        this.is2DColorMap = true;
        let cpLocs = this.controlPointsLocs;
        let control_points_groups = grV.append("g")
          .selectAll(".control_point")
          .data(cpLocs)
          .enter()
          .append("g")
            .attr("id", (_, i) => i)
            .attr("transform", d => `translate(${d},0)`)
        control_points_groups.append('line')
            .style("stroke", "black")
            .style("stroke-width", 1)
            .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", -10);
        control_points_groups.append('rect')
            .attr("x", -7.5).attr("y", -25).attr("width", 15).attr("height", 15)
            .attr("stroke", 'black').style("stroke-width", 1)
            .attr("fill", (_, i) => interpolateSinebow(i/(cpLocs.length-1)));
        let adjust2DColorMap = (start:number, end:number, oldLoc:number, newLoc:number) => {
          let canvas = document.getElementById('2d_colormap') as HTMLCanvasElement;
          cv.redraw2DColormap(JSON.stringify({'s':start, 'e':end, 'o':oldLoc, 'n':newLoc}))
            .then(e => {
              utils.drawImageData(canvas, e.data.bi_colormap);
              this.renderDensityMap(data, params);
            })
            .catch(e => { console.log(e.message); })
          lastControlPointsLocs = cpLocs.slice();
        }
        control_points_groups.call(drag().on("drag end", function(this, evt) {
          let idx = +select(this).attr("id");
          if(idx == 0 || idx == cpLocs.length-1) return;
          if(evt.x < cpLocs[idx-1]+10 || evt.x > cpLocs[idx+1]-10) return;
          cpLocs[idx] = Math.round(evt.x);
          select(this).attr("transform", `translate(${cpLocs[idx]},0)`);

          if (evt.type == "end") {
            adjust2DColorMap(cpLocs[idx-1], cpLocs[idx+1], lastControlPointsLocs[idx], cpLocs[idx]);
          }
        }) as any);

        //draw x axis
        let xLinearScale = scaleLinear().domain([minVal, maxVal]).range([0, colorbarWidth]),
            xAxis = axisBottom(xLinearScale);
        grV.append("g")
            .attr("class", "colorbar axis")
            .attr("transform", `translate(0,${colorbarWidth})`).call(xAxis);
        grV.append('text')
            .attr("x", 100)
            .attr("y", colorbarWidth+30)
            .attr("font-size", 16)
            .text("Input Intensities");
        grV.append('text')
            .attr("font-size", 16)
            .attr("transform", "translate(345,200) rotate(270)")
            .text("Output Intensities");
      } else {
        this.is2DColorMap = false;
        grV.attr("class", "vertical")
            .attr("transform", "translate(20,20)");
        const transfromFunc = utils.getTransformFunction(params.type);
        let colorScale = scaleSequential(utils.getInterpolateFunc(params.colormap))
                          .domain([minVal, maxVal].map(transfromFunc));
        let tickValues = utils.getTickValues(minVal, maxVal, transfromFunc);

        let cbV = colorbarV(colorScale, colorbarWidth, colorbarHeight)
                  .tickValues(tickValues.map(transfromFunc))
                  .tickFormat((x:number)=>utils.getInverseTransformFunction(params.type)(x).toFixed(0));
        grV.call(cbV);
      }
    },
    takeScreenshot() {
      if (!this.datasetName) { return; }

      let downloadLink = document.createElement('a');
      downloadLink.setAttribute('download', this.datasetName+'.png');
      let canvas = document.getElementById('densitymap') as HTMLCanvasElement;
      canvas.toBlob(blob => {
        let url = URL.createObjectURL(blob as Blob);
        downloadLink.setAttribute('href', url);
        downloadLink.click();
      });
    },
    showOriginalDensityMap() {
      if (this.multiscaleData.get(0) === undefined) { return; }

      this.params.type = 'linear';
      this.params.detailFactor = 1;
      let params = structuredClone(toRaw(this.params));
      dataBeingDisplayed = this.multiscaleData.get(0);
      this.renderDensityMapAndColorbar(dataBeingDisplayed, params);
      this.zoomLevel = 0;
    },
    showCDP() {
      if (this.multiscaleData.get(0) === undefined) { return; }

      this.params.type = 'log';
      this.params.filter = 'gaussian';
      this.params.filterParams.win_size = 20;
      this.params.filterParams.sigma = 2;
      this.params.detailFactor = 0;
      let params = structuredClone(toRaw(this.params));
      dataBeingDisplayed = this.multiscaleData.get(0);
      this.renderDensityMapAndColorbar(dataBeingDisplayed, params);
      this.zoomLevel = 0;
    },
    zoomDensityMap: debounce(function(this: any, e: WheelEvent | number) {
      if (!this.multiscaleData.has(this.zoomLevel)) { this.zoomLevel = 0; return; }

      if (typeof e === 'number') {
        // abort instruction if data is unavailable
        while(!this.multiscaleData.has(this.zoomLevel)) { this.zoomLevel -= 1; }
        if (e !== this.zoomLevel) { return; }

        utils.translateBottomLeftPosition(this.params.width/2, this.params.height/2, this);
      } else {
        // abort instruction if data is unavailable
        let nextLevel = e.deltaY < 0 ? this.zoomLevel + 1 : this.zoomLevel - 1;
        if (this.multiscaleData.has(nextLevel)) { this.zoomLevel = nextLevel; }
        else { return; }

        if(e.deltaY < 0) // use mouse position to zoom in
          utils.translateBottomLeftPosition(e.offsetX, e.offsetY, this);
        else // use screen center to zoom out
          utils.translateBottomLeftPosition(this.params.width/2, this.params.height/2, this);
      }
      let xMin = this.bottomLeftPosition[0], yMin = this.bottomLeftPosition[1],
          xMax = xMin + this.level0_Width, yMax = yMin + this.level0_Height;
      let data = this.multiscaleData.get(this.zoomLevel).slice(yMin, yMax).map(
        (row: number[]) => row.slice(xMin, xMax)
      );
      this.renderDensityMapAndColorbar(data);
      document.getElementById('densitymap')?.focus();
      this.previousZoomLevel = this.zoomLevel;
    }, 200, {
      'leading': true,
      'trailing': false
    }),
    panDensityMap: throttle(function(this:any, e: MouseEvent) {
      if (this.isPanning && !this.isLensMode) {
        let xShift = e.offsetX-this.previousMousePos[0],
            yShift = e.offsetY-this.previousMousePos[1];
        utils.translateBottomLeftPosition(this.params.width/2-xShift, this.params.height/2-yShift, this);

        let xMin = this.bottomLeftPosition[0], yMin = this.bottomLeftPosition[1],
            xMax = xMin + this.level0_Width, yMax = yMin + this.level0_Height;
        let data = this.multiscaleData.get(this.zoomLevel).slice(yMin, yMax).map(
          (row: number[]) => row.slice(xMin, xMax)
        );
        this.renderDensityMapAndColorbar(data);

        this.previousMousePos[0] = e.offsetX;
        this.previousMousePos[1] = e.offsetY;
      }
    }, 200)
  },
  watch: {
    isLensMode(newVal) {
      if(!this.multiscaleData.has(this.zoomLevel)) { return; }

      if(newVal) { // enable lens
        this.createRegionLensBrush();
      }
      else { // disable lens
        if(_valueBrush !== undefined) {
          select('#colorbar > g.brush').call(_valueBrush.clear);
          _valueBrush = undefined;
        }
        if(_regionBrush !== undefined) {
          select('#mapBrushLayer > g').call(_regionBrush.clear);
          _regionBrush = undefined;
        }
        selectAll('.brush').remove();
      }
    }
  },
  mounted() {
    cv.load()
      .then(() => {
        ElLoading.service().close();
        console.log('OpenCV.js is ready.');
      })
      .catch(err => { console.log(err.message); })
  }
}
</script>

<template>
  <el-container>
    <el-header>
      <el-button @click.prevent="takeScreenshot">Download</el-button>
      <el-button @click.prevent="showOriginalDensityMap">Show input density map</el-button>
      <el-button @click.prevent="showCDP">Show continuous density map</el-button>
      <el-switch
        v-model="isLensMode"
        inline-prompt
        style="margin-left: 12px; --el-switch-off-color: #ff7f00"
        size="large"
        active-text="Lens mode"
        inactive-text="Zoom mode"
        />
    </el-header>
    <el-main>
      <el-table
        v-show="isLensMode && multiscaleData.has(zoomLevel)"
        id="lensRecords"
        :data="tableData"
        max-height="250"
        style="width:380px;position:absolute;"
        border>
        <el-table-column prop="type" label="Type" width="105" />
        <el-table-column prop="range" label="Range" max-width="180" />
        <el-table-column prop="factor" label="Factor" width="105">
          <template v-slot="scope">
            <el-input-number
              v-model="scope.row.factor"
              :min="0"
              :max="99"
              size="small"
              style="width:80px;"/>
          </template>
        </el-table-column>
      </el-table>
      <canvas
        id="densitymap"
        @wheel.prevent="zoomDensityMap"
        @mousedown="isPanning=true;previousMousePos=[$event.offsetX, $event.offsetY]"
        @mouseup="isPanning=false"
        @dblclick="createDensityMapWithNewParams"
        @mousemove.prevent="panDensityMap"
        />
      <svg id="colorbar" width="100" height="400"></svg>
      <canvas
        id="2d_colormap"
        v-show="is2DColorMap"
        style="position:absolute;top:180px;"
        />
      <el-row>
        <span style="font-size:16pt; margin-right:20px;">Zoom Level: </span>
        <el-slider
          class="zoomSlider"
          v-model="zoomLevel"
          placement="bottom"
          @change="(zoomDensityMap as any)"
          show-input
          :show-input-controls="false"
          :min="0"
          :max="maxZoomLevel" />
      </el-row>
    </el-main>
  </el-container>
</template>

<style scoped>
.el-header {
  background-color: #eee;
  display: flex;
  align-items: center;
}

.zoomSlider {
  width: 250px;
}
</style>