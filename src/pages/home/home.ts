import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Content, LoadingController, NavController, PopoverController } from 'ionic-angular';

import { UsageLayer } from './usage-layer';
import { Observable } from 'rxjs/Rx';
import { UsageService } from './usage.service';

import * as Utils from './utils';
import * as d3 from 'd3';
import *  as moment from 'moment';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {

  constructor(public navCtrl: NavController,private el: ElementRef,private usageService: UsageService) {}
        //public properties
        @ViewChild('loader') loader: any;
        @ViewChild(Content) content: Content;
        billPeriod: any;
        costOverlay: boolean;
        graphType: string = 'usage';
        isWaiting: boolean = false;
        viewType: string;
        monthlyData: any;
        dailyData: any;
        minData: any;
    
        //private properties
        /**
         * Lets the Component know which whether or not to initialize the imported graphs
         */
        // graph properties
        private chart: any;
        private data: any;
        private numOfDaysInDomain: number;
        private graphCanvas: any;
        private isZooming: boolean  = false;
        private svg: any;
        private chartHeight: any;
        private height: number;
        private margin: any;
        private mode: string = 'daily';
        private selectedNode: any;
        private viewEl: any;
        private viewPortData: any;
        private xAxis: any;
        private yAxis: any;
        private xScale: any;
        private x2Scale: any;
        private usageLayer: UsageLayer;
        private width: number;
        private yScale: any;
        private zoom: any;
        private k: number;
    
    
        ngOnInit() {
            this.billPeriod = {start:'2016-10-07T22:17:48-05:00',end:'2016-11-07T22:17:48-05:00'};
            let buffer:any = 15;
            let bUnit:string = 'days';

            let queryDates = {
                start: moment(this.billPeriod.start).subtract(buffer,bUnit).format(),
                end: moment(this.billPeriod.end).add(buffer,bUnit).format()
            };

            let query = this.usageService.queryBuilder('daily',"SELECT * FROM ${{tablename}} where date(kDateTime) > date('" + queryDates.start + "') AND date(kDateTime) <= date('" + queryDates.end + "')");
            
            this.viewEl = d3.select(this.el.nativeElement);
            this.usageService.isTableEmpty().subscribe((isEmpty)=>{
                let o;
                if(isEmpty){
                    o =  this.usageService.getDaily().flatMap(()=>{
                        return this.usageService.queryDaily(query);
                    });
                } else {
                    o =  this.usageService.queryDaily(query);
                }
                o.subscribe((x)=>{
                    console.log('data returned',x);
                    this.initializeGraph(x,this.billPeriod,this.viewEl,this.content);
                },(err)=>{
                    console.log(err);
                });
            });
        }
        /**
         * @name initializeGraph
         * @description Initialize the graph, main canvas (g element), and layers.
         * The canvas is referring to the main g element that holds all of the layers (usage,weather, cost bars).
         * The canvas is appended as a G Element to the SVG element.
         */
        initializeGraph(dailyData, billPeriod, viewElement,content:Content) {
            this.dailyData = dailyData;
            this.viewEl = viewElement;
            this.content = content;
            this.data = this.dailyData;
            this.mode = 'daily';
            this.billPeriod = billPeriod;
            this.costOverlay = true;
            this.calculateChartDimensions();
    
            this.initializeScales();
            
            this.numOfDaysInDomain = Utils.getNumberOfDaysInDomain(this.xScale.domain()[0], this.xScale.domain()[1]);
    
            this.initializeCanvasElement();
    
            this.initializeDefs();
    
            this.initializeCanvasLayers();
    
            this.initializeGraphAxis();
    
            this.initializeZoom();
            
            this.zoomAndPanTo('bill');
    
            setTimeout(()=>{
                this.triggerZoomLoader('hide');   
            }, 3000)
        }
    
        /**
         * @name initializeCanvasElement
         * @description The Canvas refers to the G Element that holds all of the 
         * graph layers. Including
         * -Usage Layer
         * -Weather Layer
         * -Cost Bars Layer
         */
        initializeCanvasElement() {
            this.graphCanvas = this.svg.append("g")
                .attr("class", "graphCanvas")
                .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
        }
        /**
         * @name initializeDefs
         * @description Initializes several SVG defs.
         * Gradients for Usage Layers
         * Gradients for Cost Bars Layers
         * ClipPath for canvas
         */
        initializeDefs() {
            let defs = this.graphCanvas.append('defs');
            // append clipping path
            this.svg.append('defs').append("clipPath")
                .attr("id", "clip")
                .append("rect")
                .attr("width", this.width)
                .attr('transform', 'translate(0,-20)')
                .attr("height", this.height + 20);
            // append usage path gradient
            let gradient = defs
                .append('linearGradient')
                .attr('id', 'gradient')
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '0%')
                .attr('y2', '100%');
    
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", "#51D0D7")
                .attr("stop-opacity", 1);
    
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", "#9FE25E")
                .attr("stop-opacity", 1);
            // append cost bar gradients
            let barGradient = defs
                .append('linearGradient')
                .attr('id', 'bar-gradient')
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '0%')
                .attr('y2', '100%');
    
            barGradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", "#AAE8EC")
                .attr("stop-opacity", 1);
    
            barGradient.append("stop")
                .attr("offset", "50%")
                .attr("stop-color", "#C2EEDF")
                .attr("stop-opacity", 1);
    
            barGradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", "#E2F6D9")
                .attr("stop-opacity", 1);
            var weatherGradient = defs
                .append('linearGradient')
                .attr('id', 'weather-gradient')
                .attr('x1', '0%')
                .attr('y1', '0%')
                .attr('x2', '0%')
                .attr('y2', '100%');
    
            weatherGradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", "#FFB4AA") //#FFAD27
                .attr("stop-opacity", 1);
    
            weatherGradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", "#AADAFF") //#FFAD27
                .attr("stop-opacity", 1);
        }
    
        /**
         * @name initializeCanvasLayers
         * @description Initializes all of the graph layers.
         * UsageLayer - showing the kWh usage
         * WeatherLayer - showing the high and low temperature line and area
         * CostBarsLayer - showing the cost bar correlation to usage
         */
        initializeCanvasLayers() {
            this.usageLayer = new UsageLayer(this.data, this.graphCanvas, this.viewEl, this.height, { x: this.xScale, y: this.yScale }, this.mode);
        }
    
        /**
         * @name initializeGraphAxis
         * @descrpition initializes the canvas axis
         */
        initializeGraphAxis() {
            // setup axis
            this.xAxis = d3.axisBottom(this.xScale).tickSize(0).tickFormat(d3.timeFormat('%b %e')).ticks(5);
            this.yAxis = d3.axisLeft(this.yScale).tickValues(this.yScale.domain()).ticks(3).tickSize(0);
            this.graphCanvas.append("g")
                .attr("class", "axis axis--x")
                .attr("transform", "translate(0," + (this.height + 90) + ")")
                .call(this.xAxis);
    
            this.graphCanvas.append("g")
                .attr("class", "axis axis--y axis--kWh-y")
                .attr("transform", "translate(0," + (80) + ")")
                .call(this.yAxis);
    
            // change the axis label to show kWh
            setTimeout(() => {
                this.addkWhToAxis(this.graphCanvas.select('.axis--kWh-y'));
            }, 500);
        }
    
        /**
         * @name toggleCostOverlay
         * @descriptions Toggles the cost overlay bars for analysis
         */
        toggleCostOverlay() {
            this.costOverlay = !this.costOverlay;
            d3.select('.axis-cost').classed('on', this.costOverlay);
            d3.selectAll('.cost-bar').classed('on', this.costOverlay);
        }
    
        /**
         * @name zoomAndPanTo
         * @description Zooms to the identified levels
         * @param {string} level - The desired zoom level
         * Possible levels are - yearly, bill, weekly, daily
         */
    
        zoomAndPanTo = (level: string) => {
            let startDate,
                endDate,
                k,
                tx;
    
            if (level == 'yearly') {
                // Zoom all the way out
                this.svg.call(this.zoom.scaleBy, 0);
                return;
            } else {
                if (level == 'bill') {
                    // Get end date
                    endDate = moment(this.billPeriod.end);
                    // Get start date
                    startDate = moment(this.billPeriod.start);
    
                } else {
                    // if is weekly than add 7 days
                    // if is daily than add one day
                    let amountOfDaysToAdd = level === 'weekly' ? 7 : 1;
                    // Get start and end date
                    endDate = moment(this.xScale.domain()[1]);
                    startDate = moment(endDate).subtract(amountOfDaysToAdd, 'days');
                }
            }
    
            // Get scale k
            k = this.width / (this.xScale(endDate) - this.xScale(startDate));
            // Get transform value
            this.svg.call(this.zoom.scaleBy, k);
            tx = 0 - k * this.xScale(startDate);
    
            // if daily mode don't translate
            if (level == 'daily') return;
    
            this.svg.call(this.zoom.translateBy, tx, 0);
        }
        // private methods
        
        /**
         * @name changeDataSource
         * @description Changes the data source. There are three important data arrays: Minute, Daily, and Monthly data. 
         * As the user zooms in or out, the data source is changed. This methods accepts the new data and uses it to redraw the graphs
         */
        private changeDataSource(data) {
            var yAxisEl,
                yAxisWeather;
    
            this.drawXAxisTicks();
            this.yScale.domain([0, d3.max(data, (d: any) => { return d.kWh; })]);
            let xDomain = d3.extent(this.data, (d: any) => { return Utils.getDataPointDate(d); });
            this.xScale.domain(xDomain);
            this.usageLayer.redraw(this.mode, data, { x: this.xScale, y: this.yScale });
    
            if (this.mode != 'minute') {
                this.costOverlay = true;
            } else {

                if (this.costOverlay === true) this.toggleCostOverlay();
            }
    
            this.yAxis = d3.axisLeft(this.yScale).tickValues(this.yScale.domain()).ticks(3).tickSize(0);

            yAxisEl = this.graphCanvas.select('.axis--kWh-y').call(this.yAxis);
            this.addkWhToAxis(yAxisEl);
            this.triggerZoomLoader('hide');
            this.isZooming = false;        
        }
    
        /**
         * @name addkWhToAxis
         * @description Manually adds the text kWh to the left axis of the graph for aesthetics.
         */
        private addkWhToAxis(yAxis) {
            var yAxisHeight = yAxis.node().getBBox().height;
            yAxis.append('g')
                .attr('class', 'tick')
                .attr('transform', 'translate(0,' + (yAxisHeight / 2) + ')')
                .append('text').attr('fill', '#000').html('kWh');
        }
    
        /**
         * @name initializeZoom
         * @description initializes the zoom generator
         */
        private initializeZoom = () => {
            this.zoom = d3.zoom()
                .scaleExtent([1, this.numOfDaysInDomain * 12])
                .translateExtent([[0, 0], [this.width, this.height]])
                .extent([[0, 0], [this.width, this.height]])
                .on("zoom", this.zoomed)
            // setup zoom on svg
            this.svg.call(this.zoom);
            this.svg.on("mousedown.zoom", null)
            this.svg.on("mousewheel.zoom", null)
            this.svg.on("mousemove.zoom", null)
            this.svg.on("DOMMouseScroll.zoom", null)
            this.svg.on("dblclick.zoom", null)
        }
            /**
         * @name initializeScales
         * @description initializes the zoom generator
         */
        private initializeScales() {
            // setup scales
            this.xScale = d3.scaleTime().range([0, this.width]);
            this.x2Scale = d3.scaleTime().range([0, this.width]);
            this.yScale = d3.scaleLinear().range([this.height, 0]);
    
            let xDomain = d3.extent(this.data, (d: any) => { return Utils.getDataPointDate(d); });
            let yDomain = [0, d3.max(this.data, (d: any) => { return d.kWh; })];
    
            this.xScale.domain(xDomain);
            this.yScale.domain(yDomain);
            this.x2Scale.domain(this.xScale.domain());
        }
    
        /**
         * @name calculateChartDimensions
         * @description calculate the height and width of the chart
         * @returns {Object}
         */
        private calculateChartDimensions() {
            let contentDimensions = this.content.getContentDimensions();
            let contentViewHeight = contentDimensions.contentHeight;
            this.svg = this.viewEl.select('svg#svgChart');
            this.chart = this.viewEl.select('div.chart');
            let chartHeight = this.chart.node().offsetHeight;
            this.svg.attr('height', contentViewHeight - 84 - 50);
            let chartWidth = contentDimensions.contentWidth;
            this.margin = { top: 20, right: 40, bottom: 30, left: 40 };
            // assign to global variables    
            this.width = chartWidth - this.margin.left - this.margin.right,
                this.height = +this.svg.attr("height") - this.margin.top - this.margin.bottom - 80;
            this.svg.attr('width', chartWidth);
        }
    
        /**
         * @name drawXAxisTicks
         * @description Determines how many ticks and what date format to show them in based upon the data granulatiry.
         * Calculates the amount of days between the start and end date to determine the format and number.
         */
        private drawXAxisTicks() {
            let diff = Utils.getNumberOfDaysInDomain(this.xScale.domain()[0], this.xScale.domain()[1]);
            let tickFormat: string;
            let tickNumber: number;
    
            if (this.mode === 'minute') {
                tickFormat = '%b %e %I:%M %p'; tickNumber = 2;
            }
            else if (diff >= 100) {
                tickFormat = '%b'; tickNumber = 7;
            } else if (diff < 100) {
                tickFormat = '%b %e'; tickNumber = 4;
            } else if (diff <= 7 && diff > 4) {
                tickFormat = '%b %e'; tickNumber = 6;
            } else if (diff == 4) {
                tickFormat = '%b %e'; tickNumber = 3;
            } else if (diff < 4) {
                tickFormat = '%b %e %I:%M %p'; tickNumber = 2;
            }
    
            // Assign Tick Format and Number.
            this.xAxis.tickFormat(d3.timeFormat(tickFormat)).ticks(tickNumber);
            // Apply new Format
            this.graphCanvas.select(".axis--x").call(this.xAxis);
        }
    
        /**
         * @name reDrawGraphElements
         * @description Draws or re-draws all graph elements, based on current xScales and generators.
         */
        private reDrawGraphElements(data?,scales?){
            this.redrawUsageGraphElements(data,scales);
        }
    
        private redrawUsageGraphElements(data?,scales?) {
            this.usageLayer.redraw(this.mode,data,scales);
        }

        /**
         * @name isChangeMode
         * @description Determines whether to change current mode
         */
        private isChangeMode():boolean {

            // // get distance between domains , x1 and x2
            let diff = Utils.getNumberOfDaysInDomain(this.xScale.domain()[0], this.xScale.domain()[1]);
            if (diff > 120 && this.mode !== 'monthly') {
                this.mode = 'monthly';
                return true;
            } else if ((diff <= 120 && diff > 2) && this.mode !== 'daily') {
                this.mode = 'daily';
                return true;
            } else if (diff <= 2 && this.mode !== 'minute') {
                this.mode = 'minute';
                return true;
            } else {
                return false;
            }
        }
    
        /**
         * @name isRefreshThreshold
         * @description determin whether not if data threshold should be refreshed based on the extreminities
         * of the domain and data. We will compare (data[0] and domain[0]) and (data[data.length - 1] and domain[1]) to find out if the threshold has been
         * trangressed
         */
        isRefreshThreshold():boolean{
            // TODO determine threshold for yearly mode
            if(this.mode === 'monthly') return false;
    
            let domain,
                threshold, 
                x1Diff, 
                x2Diff;
    
            if(this.mode === 'minute'){
                threshold = {
                    unit: 'seconds',
                    value: '86400'
                };
            } else if(this.mode === 'daily'){
                threshold = {
                    unit: 'days',
                    value: '2'
                };
            }
            domain = this.xScale.domain();
            x1Diff = moment(domain[0]).diff(this.data[0].kDateTime,threshold.unit);
            x2Diff = moment(this.data[this.data.length-1].kDateTime).diff(domain[1],threshold.unit);
            console.log('xDomain',this.xScale.domain());
            console.log('x1Diff',x1Diff);
            console.log('x2Diff',x2Diff);
            console.log('threshold.value',threshold.value);
            return (x1Diff <= threshold.value || x2Diff <= threshold.value);
        }
    
    
        
    
        /**
         * @name zoomed
         * @description Callback for zoom functionality.
         */
        private zoomed = () => {
            if(this.isZooming){
                return;
            }
            let t = d3.event.transform;
            console.log(t);
            if (isNaN(t.k)) return;
            this.xScale.domain(t.rescaleX(this.x2Scale).domain());
            this.drawXAxisTicks();
            
            // Do we change the mode
            if(this.isChangeMode()){
                console.log('changedMode');
                this.getData().subscribe((x:any)=>{
                    this.data = x;
                    this.changeDataSource(this.data);
                });
            } else if(this.isRefreshThreshold()) {
                console.log('refreshing threshold');
                this.isZooming = true;
                this.triggerZoomLoader('show');
                this.getData().subscribe((x:any)=>{
                    console.log(x);
                    this.data = x;
                    this.changeDataSource(this.data);
                });
            } else {
                console.log('didn\'t do anything');
                // plainly render the graph updating it regularly
                this.reDrawGraphElements();
            }
        }

        private getData(){
            // if the mode is yearly then return the data immediately
            // return immediate data because we are not buffering data right now
            if(this.mode == 'monthly'){
                this.data = this.monthlyData;
                return Observable.of(this.data);
            }
    
            // if(this.mode == 'daily'){
            //     this.data = this.dailyData;
            //     return Observable.of(this.data);
            // }
    
            let xMin,
                xMax,
                buffer: number,
                bufferUnit: string = 'seconds',
                bufferXmin,
                bufferXmax,
                numberOfPoints,
                distanceBtwnXminXmax,
                dataLength,
                domain;
    
                domain = this.xScale.domain();
                xMin = moment(domain[0]);
                xMax = moment(domain[1]);
    
                // calculate buffer
                if(this.mode == 'daily'){
                    bufferUnit = 'days';
                    buffer = 15;
                } else if (this.mode == 'minute'){
                    bufferUnit = 'seconds';
                    distanceBtwnXminXmax = xMax.diff(xMin,bufferUnit);
                    buffer = 86400;
                }
    
                bufferXmin = xMin.subtract(buffer,bufferUnit);
                bufferXmax = xMax.add(buffer,bufferUnit);
                
    
    
                let query = this.usageService.queryBuilder(this.mode,"SELECT * FROM ${{tablename}} where date(kDateTime) > date('" + bufferXmin.format() + "') AND date(kDateTime) <= date('" + bufferXmax.format() + "')");
                
                return this.mode === 'minute' ? this.usageService.queryMin(query) : this.usageService.queryDaily(query).delay(1000);
        }
    
        
        /**
         * @name triggerZoomLoader
         * @description Hide/Show the zoom loader
         */
        triggerZoomLoader(action:string = 'show'){
            if(action == 'show'){
                this.loader.nativeElement.classList.remove('hidden');
            } else {
                this.loader.nativeElement.classList.add('hidden');            
            }
        }

}

export interface BillPeriod {
    start: string,
    end: string
}