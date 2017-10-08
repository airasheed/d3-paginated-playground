import * as d3 from 'd3';

import * as Utils from './utils';

export class UsageLayer {
    canvas: any;
    canvasMode: string;
    data: any[];
    height;
    width;
    domains: Domains;
    generators: {
        line: any,
        area: any
    }
    paths: Paths;
    circles: any;
    scales: Scales;
    xAxis: any;
    yAxis: any;
    viewElement: any;
    selectedNode: any;

    constructor(data, canvas, viewElement,height, scales: Scales, canvasMode:string) {
        this.data = data;
        this.canvas = canvas;
        this.viewElement = viewElement;
        this.height = height;        
        this.scales = scales;
        this.canvasMode = canvasMode;
        this.draw();
    }

    createGenerator(scales){
        this.scales = scales;
        this.generators = {
            line: d3.line()
                .curve(d3.curveMonotoneX)
                .x((d: any) => this.scales.x(Utils.getDataPointDate(d)))
                .y((d: any) => this.scales.y(d.kWh)),
            area: d3.area()
                .curve(d3.curveMonotoneX)
                .x((d: any) => { return this.scales.x(Utils.getDataPointDate(d)) })
                .y0(this.height)
                .y1((d: any) => this.scales.y(d.kWh))
        }
    }

    /**
     * @name draw
     * @description Draws all of the usage and cost elements.
     */
    draw() {
        this.createGenerator(this.scales);
        this.paths = {
            area:  this.canvas.append("path"),
            line: this.canvas.append('path')
        };
        
        this.paths.area.attr("class", "area")
            .datum(this.data)
            .attr('height', this.height)
            .attr('fill-opacity', .2)
            .attr('clip-path', 'url(#clip)')
            .attr("d", this.generators.area)
            .attr("transform", "translate(0," + 80 + ")")
            .style("fill", "url(#gradient)");

        this.paths.line.datum(this.data)
            .datum(this.data)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('clip-path', 'url(#clip)')
            .attr('stroke', '#31B5BB')
            .attr('stroke-width', '2px')
            .attr("transform", "translate(0," + 80 + ")")
            .attr('d', this.generators.line);


        this.circles = this.canvas.selectAll('circle')
            .data(this.data).enter()
            .append('circle')
            .attr('cx', (d: any) => { return this.scales.x(Utils.getDataPointDate(d)); })
            .attr('cy', (d: any) => { return this.scales.y(d.kWh); })
            .attr('r', 15)
            .attr('class', 'circle')
            .attr('clip-path', 'url(#circleClip)')
            .attr("transform", "translate(0," + 80 + ")")
            .on('click', this.handleMouseOver);
    }
    /**
     * @name redraw
     * @description Redraws all of the elements appropriately
     * @param {string} canvasMode - the current view canvas view canvasMode
     * @param {any[]} data - the new data set
     * @param {Scales} scales - updated scales
     */
    redraw(canvasMode: string, data?: any[], scales?: Scales) {
        this.canvasMode = canvasMode;
        
        // Redraw Paths w/ new data source
        if (data && scales) {
            console.group('redraw data && scales');
            console.log(data[0],data[data.length-1]);
            console.log('new domain',scales.x.domain());
            this.createGenerator(scales);
            
            this.scales = scales;
            this.data = data;
            this.paths.area.datum(data).attr("d", this.generators.area);
            this.paths.line.datum(data).attr("d", this.generators.line);
            this.circles.remove();
            this.circles = this.canvas.selectAll('circle').data(data).enter().append('circle')
                .attr('cx', (d: any) => { return this.scales.x(Utils.getDataPointDate(d)); })
                .attr('cy', (d: any) => { return this.scales.y(d.kWh); })
                .attr('r', 15)
                .attr('class', 'circle')
                .attr('clip-path', 'url(#circleClip)')
                .attr("transform", "translate(0," + 80 + ")")
                .on('click', this.handleMouseOver);
            return;
        }
        console.log('redraw data',this.data[0]);
        console.log('redraw data',this.data[this.data.length-1]);
        console.log()
        // draw with old data source
        this.paths.area.attr("d", this.generators.area);
        this.paths.line.attr('d', this.generators.line);
        this.circles
            .attr('cx', (d: any) => { return this.scales.x(Utils.getDataPointDate(d)); })
            .attr('cy', (d: any) => { return this.scales.y(d.kWh); })
            .attr("transform", "translate(0," + 80 + ")");
    }

    private handleMouseOver = (d, i) => {
        let target = d3.event.target;
        let matrix = target.getScreenCTM().translate(+target.getAttribute('cx'),
            +target.getAttribute('cy'));

        if (!this.selectedNode) {
            this.selectedNode = { idx: i, ref: target }
            return;
        }

        if (this.selectedNode.idx === i) {
            return;
        }

        this.removeHighlight(this.selectedNode.ref);
        this.selectedNode = { idx: i, ref: target };
        this.highlight(this.selectedNode.ref);

    }

    private highlight(node) {
        return d3.select(node).attr('class', 'circle selected').attr('r', 8);;
    }

    private removeHighlight(node) {
        return d3.select(node).attr('class', 'circle').attr('r', 15);
    }
}

interface Scales {
    x: any;
    y: any;
}

interface Domains {
    y?: any;
    x?: any;
}

interface Paths {
    line?: any;
    area?: any;
    circles?: any;
}
