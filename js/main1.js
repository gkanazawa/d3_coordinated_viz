(function(){

var attrArray = ["Popsize_Mean", "Popsize_Lower95", "Popsize_Upper95"];
var expressed = attrArray[0];

var chartWidth = window.innerWidth * 0.4,
    chartHeight = 700,
    leftPadding = 20,
    rightPadding = 15,
    topBottomPadding = 10,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

var yScalePop = d3.scaleLinear()
  .range([450, 0])
  .domain([0, 45000]);

window.onload = setMap();

function setMap(){

  var width = window.innerWidth * 0.45,
      height = 700;

  var map = d3.select(".container")
    .append("svg")
    .attr("class", "map")
    .attr("width", width)
    .attr("height", height);

  var projection = d3.geoAlbers()
    .center([6, 44.7])
    // .rotate([0, 1, 0])
    .scale(8900)
    .translate([width / 2, height  / 2]);

  var path = d3.geoPath()
    .projection(projection);

  var promises = [];
  promises.push(d3.csv("data/Deer_PopSize.csv"));
  promises.push(d3.csv("data/Deer_PopDensity.csv"));
  promises.push(d3.json("data/US_States.topojson"));
  promises.push(d3.json("data/DeerZones_1.topojson"));
  Promise.all(promises).then(callback);

  console.log(promises[0]);
  console.log(promises[1]);
  console.log(promises[2]);
  console.log(promises[3]);

  function callback(data){

    [csvPop, csvDen, usofa, wiscDeer] = data;

    setGraticule(map, path);

    var usStates = topojson.feature(usofa, usofa.objects.cb_2018_us_state_20m),
      wiscZones = topojson.feature(wiscDeer, wiscDeer.objects.DeerZones_1).features;

    var states = map.append("path")
      .datum(usStates)
      .attr("class", "states")
      .attr("d", path);

    var zones = map.selectAll(".zones")
      .data(wiscZones)
      .enter()
      .append("path")
      .attr("class", function(d){
        return d.properties.code;
      })
      .attr("d", path);

      // join csv data to geoJSON enumeration units
      wiscZones = joinData(wiscZones, csvPop);

      var colorScale = makeColorScale(csvPop);

      //add enumeration units to map
      setEnumerationUnits(wiscZones, map, path, colorScale);

      // add chart to map
      setChart(csvPop, colorScale);

      setLabel(csvPop);
      // moveLabel();

      createDropdown(csvPop);

  }; //end of callback()
}; //end of setMap()

function setGraticule(map, path){

  var graticule = d3.geoGraticule().step([5, 5]);

  var gratBackground = map.append("path")
    .datum(graticule.outline())
    .attr("class", "gratBackground")
    .attr("d", path);
};

function joinData(wiscZones, csvPop){

  for (var i=0; i<csvPop.length; i++){
    var csvZone = csvPop[i];
    var csvKey = csvPop.code;

    for (var a=0; a<wiscZones.length; a++){

      var geojsonProps = wiscZones[a].properties;
      var geojsonKey = geojsonProps.code;

      if (geojsonKey == csvKey){

        attrArray.forEach(function(attr){
          var val = parseFloat(csvZone[attr]);
          geojsonProps[attr] = val;
        });
      };
    };
  };
  return wiscZones;
};

// create color scale for enumeration units
function makeColorScale(data){
  var colorClasses = [
    "#13EBDA",
    "#067CD4",
    "#0719F7",
    "#06D453",
    "#3FF511",

  ];

  var colorScale = d3.scaleSequential()
    .range(colorClasses);

  var domainArray = [];
  for (var i=0; i<data.length; i++){
    var val = parseFloat(data[i][expressed]);
    domainArray.push(val);
  };

  var clusters = ss.ckmeans(domainArray, 5);

  domainArray = clusters.map(function(d){
    return d3.min(d);
  });

  domainArray.shift();

  colorScale.domain(domainArray);

  return colorScale;
};

// helper function for in case not all units have values (sets gray if no value)
function choropleth(props, colorScale){

  var val = parseFloat(props[expressed]);

  if (typeof val == 'number' && !isNaN(val)){
    return colorScale(val);
  }else{
    return "#CCC";
  };
};

// color in deer zones choropleth
function setEnumerationUnits(wiscZones, map, path, colorScale){

  var zones = map.selectAll(".zones")
    .data(wiscZones)
    .enter()
    .append("path")
    .attr("class", function(d){
      return "zones " + d.properties.code;
    })
    .attr("d", path)
    .style("fill", function(d){
      return choropleth(d.properties, colorScale);
    })
    .on("mouseover", function(d){
      // console.log(d);
      highlight(d.currentTarget.__data__);
    })
    .on("mouseout", function(d){
      dehighlight(d.currentTarget.__data__);
    })
    .on("mousemove", function(d){
      moveLabel(d.currentTarget.__data__);
    });

    var desc = zones.append("desc")
      .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};

function setChart(csvPop, colorScale){

  // create another svg to hold bar chart
  var chart = d3.select(".container")
    .append("svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("class", "chart");

  var chartBackground = chart.append("rect")
    .attr("class", "chartBackground")
    .attr("width", chartInnerWidth)
    .attr("height", chartInnerHeight)
    .attr("transform", translate);

  var csvmax = d3.max(csvPop, function(d) { return parseFloat(d[expressed]); });
  console.log(csvmax);
  var yScale = d3.scaleLinear()
    .range([0, chartHeight])
    .domain([0, csvmax + 20]);

  var bars = chart.selectAll(".bar")
    .data(csvPop)
    .enter()
    .append("rect")
    .sort(function(a, b){
      return a[expressed]-b[expressed]
    })
    .attr("class", function(d){
      return "bar " + d.code;
    })
    .attr("width", chartInnerWidth / csvPop.length - 1)
    .on("mouseover", function(d){
      highlight(d.currentTarget.__data__);
    })
    .on("mouseout", function(d){
      dehighlight(d.currentTarget.__data__);
    })
    .on("mousemove", function(d){
      moveLabel(d.currentTarget.__data__);
    });

  var desc = bars.append("desc")
    .text('{"stroke": "none", "stroke-width": "0px"}');

  var chartTitle = chart.append("text")
    .attr("x", 20)
    .attr("y", 675)
    .attr("class", "chartTitle")
    .text("Estimates of Deer Population and Deer Population Density");

  var yAxis = d3.axisLeft(yScalePop)
    .scale(yScalePop);

  var axis = chart.append("g")
    .attr("class", "axis")
    .attr("transform", translate)
    .call(yAxis);

  var chartFrame = chart.append("text")
    .attr("class", "chartFrame")
    .attr("width", chartInnerWidth)
    .attr("height", chartInnerHeight)
    .attr("transform", translate);

  updateChart(bars, csvPop.length, colorScale);
};  // end of setChart()

function highlight(props){

  var selected = d3.selectAll("." + props.code)
    .attr("stroke", "blue")
    .attr("stroke-width", 2);
};

function dehighlight(props){
  var selected = d3.selectAll("." + props.code)
    .style("stroke", function(){
      return getStyle(event.currentTarget, "stroke")
    })
    .style("stroke-width", function(){
      return getStyle(event.currentTarget, "stroke-width")
    });

  function getStyle(element, styleName){
    var styleText = d3.select(element)
      .select("desc")
      .text();

    var styleObject = JSON.parse(styleText);

    return styleObject[styleName];
  }; // end of getStyle
  d3.select(".infolabel")
    .remove();
}; // end of dehighlight

function setLabel(props){
  // label content
  var labelAttribute = "<h1>" + props[expressed] +
    "</h1><b>" + expressed + "</b>";

  // create info label div
  var infolabel = d3.select(".container")
    .append("div")
    .attr("class", "infolabel")
    .attr("id", props.name + "_label")
    .html(labelAttribute);

  var zoneName = infolabel.append("div")
    .attr("class", "labelname")
    .html(props.name);
};

function moveLabel(){
  // use coords of mousemove event to label coordinates
  var x = event.clientX + 10,
      y = event.clientY - 75;

  // var labelWidth = d3.select(".infolabel")
  //   .node()
  //   .getBoundingClientRect()
  //   .width;
  //
  // //use coordinates of mousemove event to set label coordinates
  // var x1 = event.clientX + 10,
  //     y1 = event.clientY - 75,
  //     x2 = event.clientX - labelWidth - 10,
  //     y2 = event.clientY + 25;
  //
  // //horizontal label coordinate, testing for overflow
  // var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
  // //vertical label coordinate, testing for overflow
  // var y = event.clientY < 75 ? y2 : y1;

  d3.select(".infolabel")
      .style("left", x + "px")
      .style("top", y + "px");
};

function createDropdown(){
  // add select element
  var dropdown = d3.select(".container")
    .append("select")
    .attr("class", "dropdown")
    .on("change", function(){
      changeAttribute(this.value, csvPop)
    });

  // add initial option
  var titleOption = dropdown.append("option")
    .attr("class", "titleOption")
    .attr("disabled", "true")
    .text("Select Attribute");

  var attrOptions = dropdown.selectAll("attrOptions")
    .data(attrArray)
    .enter()
    .append("option")
    .attr("value", function(d){ return d })
    .text(function(d){ return d });
};

// dropdown change event listener
function changeAttribute(attribute, csvPop){
  expressed = attribute;  // changes expressed attribute
  var colorScale = makeColorScale(csvPop);  //recreates color scale
  var zones = d3.selectAll(".zones")
    .transition()
    .duration(1000)
    .style("fill", function(d){
      return choropleth(d.properties, colorScale) //recolors enumeration units
    });

  var bars = d3.selectAll(".bar")
    .sort(function(a, b){
      return b[expressed] - a[expressed];
    })
    .transition()
    .delay(function(d, i){
      return i * 20;
    })
    .duration(500);

  updateChart(bars, csvPop.length, colorScale);
}; // end of changeAttribute

function updateChart(bars, n, colorScale){
  bars.attr("x", function(d, i){
    return i * (chartInnerWidth / csvPop.length) + leftPadding;
  })  // this resorts the bars
  .attr("height", function(d, i){
    return 463 - yScalePop(parseFloat(d[expressed]));
  })
  .attr("y", function(d, i){
    return yScalePop(parseFloat(d[expressed])) + topBottomPadding;
  })
  .style("fill", function(d){
    return choropleth(d, colorScale);
  });
}; // end of updateChart

})();