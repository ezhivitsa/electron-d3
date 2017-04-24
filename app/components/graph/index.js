import React, { Component } from 'react'
import { withRouter } from 'react-router'
import * as d3 from 'd3'
import _defaultsDeep from 'lodash/defaultsDeep'

import DirectedGraph from '../../algorithm/graph/graph'
import PrimeAlgorithm from '../../algorithm/prim/algorithm'
import StabilyRadii from '../../algorithm/stability radii/algorithm'
import SecondMST from '../../algorithm/second mst/algorithm'

import styles from './styles.css'

import graphService from '../../server/resources/graphs/graphs.service'

const defaultOptions = {
  data: { nodes: [], links: [] },
  radius: 15,
  stroke: 4,
  force1: {
    distance: (l, i) => (l.distance + 1) * 25,
    charge: (v, i) => v.weight ? -30 * (v.weight + 5) : -500,
    gravity: 0.005,
    friction: 0.7
  },
  force2: {
    distance: (l) => l.cyclic ? l.distance * 15 : (l.distance + 1) * 5,
    gravity: 0.0, // JUST A TAD OF GRAVITY TO HELP KEEP THOSE CURVY BUTTOCKS DECENT
    charge: (d, i) => {
      // HELPER NODES HAVE A MEDIUM-TO-HIGH CHARGE, DEPENDING ON THE NUMBER OF LINKS THE RELATED FORCE LINK REPRESENTS.
      // HENCE BUNDLES OF LINKS FRO A->B WILL HAVE HELPER NODES WITH HUGE CHARGES: BETTER SPREADING OF THE LINK PATHS.
      //
      if (d.fixed) return -10
      let l = d.link_ref
      if (l.source.link_count > 0 || l.target.link_count > 0) return -30
      return -1
    },
    friction: 0.95
  },
  zoom_range: [0.5, 10],
  loop_curve: 0.5,
  pathgen: d3.svg.line().interpolate('basis'),
  cycle_pathgen: d3.svg.line().interpolate('basis'),
  path_fill: 'none',
  path_stroke: '#5CDACC',
  bcolor: 'rgba(0,0,0,0)',
  nodeid: (n) => n.name,
  fast_stop_threshold: 0.0
}

const dynamicMultigraph = (option) => {
  _defaultsDeep(option, defaultOptions)

  let width = option.width
  let height = option.height
  let debug = option.debug // 0: DISABLE, 1: ALL, 2: ONLY FORCE2 + CURVES, 3: CURVES ONLY
  let pathgen = option.pathgen
  let cyclePathgen = option.cycle_pathgen
  let data = option.data
  let root = option.root
  let radius = option.radius // DEFAULT POINT RADIUS
  // CYCLIC ~ SELF-REFERENTIAL LINKS: DETERMINES THE 'RADIUS' OF
  // THE BEZIER PATH CONSTRUCTED FOR THE LINK;
  let cycleCurvep = option.loop_curve
  let bcolor = option.bcolor

  // ==

  // PREPARE DATA STRUCT TO ALSO CARRY OUR 'PATH HELPER NODES':

  data.helpers = {
    left: {},
    right: {},
    cyclic: {}
  }

  // ==

  // INIT SVG ROOT ELEMENT

  let vis = d3.select(root).append('svg').attr('width', width).attr('height', height)

  let debugG = vis.append('g').attr('class', 'debug_g')
  let pathTraceAlpha = debugG.append('path').attr('class', 'trace-alpha')
  let pathTraceC2 = debugG.append('path').attr('class', 'trace-c2')

  let superwrap = vis.append('g').attr('width', width).attr('height', height)

  let background = superwrap.append('svg:rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', bcolor)

  let wrap = superwrap.append('g').attr('width', width).attr('height', height)

  let linkg = wrap.append('g').attr('class', 'linkg')
  let helperNodeg = wrap.append('g').attr('class', 'helper_nodeg')

  let centerOfMass = wrap.append('g')
    .attr('class', 'center-of-mass')
    .append('circle')
    .attr('class', 'center-of-mass')
    .attr('visibility', (debug === 1) ? 'visible' : 'hidden')
    .attr('r', 10)

  let helperLinkg = wrap.append('g').attr('class', 'helper_linkg')
  let nodeg = wrap.append('g').attr('class', 'nodeg')

  let edgeText = wrap.append('g').attr('class', 'edge-text')

  // ==

  // LOCAL letIABLES

  let link
  let hlink
  let etext
  let hnode
  let alphaTrace = []
  let alphaLine
  let alphaScale
  let c2Trace = []
  let c2Line
  let c2Scale

  // ==

  // DRAWING TOOLS

  alphaLine = d3.svg.line()
    .x((d, i) => i)
    .y((d, i) => d)

  alphaScale = d3.scale.pow()
    .exponent(-1.0)
    .domain([5, 0.005])
    .range([10, height - 10])
    .clamp(true)

  c2Scale = d3.scale.log()
    .domain([0.01, width * height])
    .range([10, height - 10])
    .clamp(true)

  c2Line = d3.svg.line()
    .x((d, i) => i)
    .y((d, i) => d)

  let fill = d3.scale.category20()

  // ==

  // ID GENERATORS

  let nodeid = option.nodeid

  let linkid = (l) => {
    let u = nodeid(l.source)
    let v = nodeid(l.target)
    return u < v ? u + '|' + v : v + '|' + u
  }

  // ==

  // INIT DATA STRUCTURES
  let nm = {} // NODE MAP
  let nml = {} // NODE MAP FOR LEFT-SIDE 'LINK PATH HELPER NODES'
  let nmr = {} // NODE MAP FOR RIGHT-SIDE 'LINK PATH HELPER NODES'
  let nmc = {} // NODE MAP FOR CYCLIC ~ SELF-REFERENCING 'LINK PATH HELPER NODES'
  let nmimg = {} // NODE MAP FOR CLONED NODES FOR FORCE2
  let lm = {} // LINK MAPS - LM ~ LML-LMM-LMR
  let lml = {}
  let lmm = {}
  let lmr = {}
  let lmc = {}
  let nodes = [] // OUTPUT NODES
  let helperNodes = [] // HELPER FORCE GRAPH NODES

  let PREV_UUID = -1
  let uuid = () => ++PREV_UUID

  let addEdge = (net, e) => {
    let u
    let v
    let rui
    let rvi
    let ui
    let vi
    let lu
    let rv
    let uimg
    let vimg
    // let i
    let ix
    let l
    let ll
    let l_
    let lr

    // WHILE D3.LAYOUT.FORCE DOES CONVERT LINK.SOURCE AND LINK.TARGET NUMERIC VALUES TO DIRECT NODE REFERENCES,
    // IT DOESN'T FOR OTHER ATTRIBUTES, SUCH AS .REAL_SOURCE, SO WE DO NOT USE INDEXES IN NM[] BUT DIRECT NODE
    // REFERENCES TO SKIP THE D3.LAYOUT.FORCE IMPLICIT LINKS CONVERSION LATER ON AND ENSURE THAT BOTH .SOURCE/.TARGET
    // AND .REAL_SOURCE/.REAL_TARGET ARE OF THE SAME TYPE AND POINTING AT VALID NODES.
    rui = nodeid(e.source)
    rvi = nodeid(e.target)
    u = nm[rui]
    v = nm[rvi]
    if (u === v) {
      // SKIP NON-ORIGINAL LINKS FROM NODE TO SAME (A-A); THEY ARE RENDERED AS 0-LENGTH LINES ANYHOW. LESS LINKS IN ARRAY = FASTER ANIMATION.

      // SELF-REFERENTIAL 'LINKS' ARE PRODUCED AS 2 LINKS+1 HELPER NODE; THIS IS A GENERALIZED APPROACH SO WE
      // CAN SUPPORT MULTIPLE SELF-REFERENTIAL LINKS AS THANKS TO THE FORCE LAYOUT
      // THOSE HELPERS WILL ALL BE IN DIFFERENT PLACES, HENCE THE LINK 'PATH' FOR EACH
      // PARALLEL LINK WILL BE DIFFERENT.
      ui = nodeid(u)
      ix = ui + '|' + ui + '|' + uuid()
      l = lm[ix] || (lm[ix] = {
        source: u,
        target: u,
        size: 1,
        distance: e.weight || 1,
        cyclic: true,
        ix: ix
      })
      l.pos = net.links.push(l) - 1
      // LINK(U,V) ==> U -> LU -> U
      lu = nmc[ix] ||
        (nmc[ix] = data.helpers.cyclic[ix] ||
        (data.helpers.cyclic[ix] = {
          ref: u,
          id: '_ch_' + ix,
          size: -1,
          link_ref: l,
          cyclic_helper: true
        })
      )
      lu.pos = net.helper_nodes.push(lu) - 1
      uimg = nmimg[ui]
      l_ = lmc[ix] || (lmc[ix] = {
        g_ref: l,
        ref: e,
        id: 'c' + ix,
        source: uimg,
        target: lu,
        real_source: u,
        size: 1,
        distance: e.weight || 1,
        cyclic: true,
        ix: ix
      })
      l_.pos = net.helper_links.push(l_) - 1
      l_.pos2 = net.helper_render_links.push(l_) - 1
      return
    }
    // 'LINKS' ARE PRODUCED AS 3 LINKS+2 HELPER NODES; THIS IS A GENERALIZED APPROACH SO WE
    // CAN SUPPORT MULTIPLE LINKS BETWEEN ELEMENT NODES, ALWAYS, AS EACH
    // 'ORIGINAL LINK' GETS ITS OWN SET OF 2 HELPER NODES AND THANKS TO THE FORCE LAYOUT
    // THOSE HELPERS WILL ALL BE IN DIFFERENT PLACES, HENCE THE LINK 'PATH' FOR EACH
    // PARALLEL LINK WILL BE DIFFERENT.
    ui = nodeid(u)
    vi = nodeid(v)

    ix = (ui < vi ? ui + '|' + vi : vi + '|' + ui) + '|' + uuid()
    l = lm[ix] || (lm[ix] = {
      source: u,
      target: v,
      size: 0,
      distance: e.weight || 1,
      ix: ix
    })
    if (l.pos === undefined) {
      l.pos = net.links.push(l) - 1
    }

    // LINK(U,V) ==> U -> LU -> RV -> V
    lu = nml[ix] || (nml[ix] = data.helpers
      .left[ix] || (data.helpers.left[ix] = {
        ref: u,
        id: '_lh_' + ix,
        size: -1,
        link_ref: l,
        ix: ix
      }))
    if (lu.pos === undefined) {
      lu.pos = net.helper_nodes.push(lu) - 1
    }
    rv = nmr[ix] || (nmr[ix] = data.helpers
      .right[ix] || (data.helpers.right[ix] = {
        ref: v,
        id: '_rh_' + ix,
        size: -1,
        link_ref: l,
        ix: ix
      }))
    if (rv.pos === undefined) {
      rv.pos = net.helper_nodes.push(rv) - 1
    }
    uimg = nmimg[ui]
    vimg = nmimg[vi]
    ll = lml[ix] || (lml[ix] = {
      g_ref: l,
      ref: e,
      id: 'l' + ix,
      source: uimg,
      target: lu,
      real_source: u,
      real_target: v,
      size: 0,
      distance: e.weight || 1,
      left_seg: true,
      ix: ix
    })
    if (ll.pos === undefined) {
      ll.pos = net.helper_links.push(ll) - 1
    }
    l_ = lmm[ix] || (lmm[ix] = {
      g_ref: l,
      ref: e,
      id: 'm' + ix,
      source: lu,
      target: rv,
      real_source: u,
      real_target: v,
      size: 0,
      distance: e.weight || 1,
      middle_seg: true,
      ix: ix
    })
    if (l_.pos === undefined) {
      l_.pos = net.helper_links.push(l_) - 1
      l_.pos2 = net.helper_render_links.push(l_) - 1
    }
    lr = lmr[ix] || (lmr[ix] = {
      g_ref: l,
      ref: e,
      id: 'r' + ix,
      source: rv,
      target: vimg,
      real_source: u,
      real_target: v,
      size: 0,
      distance: e.weight || 1,
      right_seg: true,
      ix: ix
    })
    if (lr.pos === undefined) {
      lr.pos = net.helper_links.push(lr) - 1
    }

    ++l.size
    ++ll.size
    ++l_.size
    ++lr.size

    // these are only useful for single-linked nodes, but we don't care; here we have everything we need at minimum cost.
    if (l.size === 1 || l.size === '1') {
      ++u.link_count
      ++v.link_count
      u.first_link = l
      v.first_link = l
      u.first_link_target = v
      v.first_link_target = u
    }
  }

  let delEdge = function (net, e) {
    let u
    let v
    let rui
    let rvi
    let ui
    let vi
    let lu
    let rv
    let uimg
    let vimg
    let i
    let ix
    let l
    let ll
    let l_
    let lr
    let j

    // WHILE D3.LAYOUT.FORCE DOES CONVERT LINK.SOURCE AND LINK.TARGET NUMERIC VALUES TO DIRECT NODE REFERENCES,
    // IT DOESN'T FOR OTHER ATTRIBUTES, SUCH AS .REAL_SOURCE, SO WE DO NOT USE INDEXES IN NM[] BUT DIRECT NODE
    // REFERENCES TO SKIP THE D3.LAYOUT.FORCE IMPLICIT LINKS CONVERSION LATER ON AND ENSURE THAT BOTH .SOURCE/.TARGET
    // AND .REAL_SOURCE/.REAL_TARGET ARE OF THE SAME TYPE AND POINTING AT VALID NODES.
    rui = nodeid(e.real_source || e.source)
    rvi = nodeid(e.real_target || e.real_source || e.target)
    u = nm[rui]
    v = nm[rvi]
    if (u === v) {
      // SKIP NON-ORIGINAL LINKS FROM NODE TO SAME (A-A); THEY ARE RENDERED AS 0-LENGTH LINES ANYHOW. LESS LINKS IN ARRAY = FASTER ANIMATION.

      // SELF-REFERENTIAL 'LINKS' ARE PRODUCED AS 2 LINKS+1 HELPER NODE; THIS IS A GENERALIZED APPROACH SO WE
      // CAN SUPPORT MULTIPLE SELF-REFERENTIAL LINKS AS THANKS TO THE FORCE LAYOUT
      // THOSE HELPERS WILL ALL BE IN DIFFERENT PLACES, HENCE THE LINK 'PATH' FOR EACH
      // PARALLEL LINK WILL BE DIFFERENT.
      ix = e.ix
      l = lm[ix]
      delete lm[ix]
      j = net.links.length
      while (--j > l.pos) {
        --net.links[j].pos
      }
      net.links.splice(l.pos, 1)
      // LINK(U,V) ==> U -> LU -> U

      lu = nmc[ix]
      delete nmc[ix]
      delete data.helpers.cyclic[ix]
      j = net.helper_nodes.length
      while (--j > lu.pos) {
        --net.helper_nodes[j].pos
        --net.helper_nodes[j].index
      }
      net.helper_nodes.splice(lu.pos, 1)

      l_ = lmc[ix]
      delete lmc[ix]
      j = net.helper_links.length
      while (--j > l_.pos) {
        --net.helper_links[j].pos
      }
      net.helper_links.splice(l_.pos, 1)
      j = net.helper_render_links.length
      while (--j > l_.pos2) {
        --net.helper_render_links[j].pos2
      }
      net.helper_render_links.splice(l_.pos2, 1)

      return
    }
    // 'LINKS' ARE PRODUCED AS 3 LINKS+2 HELPER NODES; THIS IS A GENERALIZED APPROACH SO WE
    // CAN SUPPORT MULTIPLE LINKS BETWEEN ELEMENT NODES, ALWAYS, AS EACH
    // 'ORIGINAL LINK' GETS ITS OWN SET OF 2 HELPER NODES AND THANKS TO THE FORCE LAYOUT
    // THOSE HELPERS WILL ALL BE IN DIFFERENT PLACES, HENCE THE LINK 'PATH' FOR EACH
    // PARALLEL LINK WILL BE DIFFERENT.
    ui = nodeid(u)
    vi = nodeid(v)

    ix = e.ix
    l = lm[ix]
    if (--l.size === 0) {
      delete lm[ix]
    }
    j = net.links.length
    while (--j > l.pos) {
      --net.links[j].pos
    }
    net.links.splice(l.pos, 1)

    // LINK(U,V) ==> U -> LU -> RV -> V
    lu = nml[ix]
    if (l.size === 0) {
      delete nml[ix]
      delete data.helpers.left[ix]
    }
    j = net.helper_nodes.length
    while (--j > lu.pos) {
      --net.helper_nodes[j].pos
      --net.helper_nodes[j].index
    }
    net.helper_nodes.splice(lu.pos, 1)

    rv = nmr[ix]
    if (l.size === 0) {
      delete nmr[ix]
      delete data.helpers.right[ix]
    }
    j = net.helper_nodes.length
    while (--j > rv.pos) {
      --net.helper_nodes[j].pos
      --net.helper_nodes[j].index
    }
    net.helper_nodes.splice(rv.pos, 1)

    uimg = nmimg[ui]
    vimg = nmimg[vi]
    ll = lml[ix]
    if (--ll.size === 0) {
      delete lml[ix]
    }
    j = net.helper_links.length
    while (--j > ll.pos) {
      --net.helper_links[j].pos
    }
    net.helper_links.splice(ll.pos, 1)

    l_ = lmm[ix]
    if (--l_.size === 0) {
      delete lmm[ix]
    }
    j = net.helper_links.length
    while (--j > l_.pos) {
      --net.helper_links[j].pos
    }
    net.helper_links.splice(l_.pos, 1)
    j = net.helper_render_links.length
    while (--j > l_.pos2) {
      --net.helper_render_links[j].pos2
    }
    net.helper_render_links.splice(l_.pos2, 1)

    lr = lmr[ix]
    if (--lr.size === 0) {
      delete lmr[ix]
    }
    j = net.helper_links.length
    while (--j > lr.pos) {
      --net.helper_links[j].pos
    }
    net.helper_links.splice(lr.pos, 1)

    // these are only useful for single-linked nodes, but we don't care; here we have everything we need at minimum cost.
    if (l.size === 0) {
      --u.link_count
      --v.link_count
      u.first_link = null
      v.first_link = null
      u.first_link_target = null
      v.first_link_target = null
    }
  }

  let addVertex = function (net, n) {
    n.x = width / 2
    n.y = height / 2
    let img

    // THE NODE SHOULD BE DIRECTLY VISIBLE
    nm[nodeid(n)] = n
    img = {
      ref: n,
      x: n.x,
      y: n.y,
      size: 0,
      fixed: 1,
      id: nodeid(n)
    }
    nmimg[nodeid(n)] = img
    n.pos = nodes.push(n) - 1
    img.pos = net.helper_nodes.push(img) - 1

    n.link_count = 0
    n.first_link = null
    n.first_link_target = null
  }

  let delVertex = function (net, n) {
    let img = nmimg[nodeid(n)]
    let j

    j = net.links.length
    let list = []
    while (j--) {
      if (n === net.links[j].source || n === net.links[j].target) {
        list.push(net.links[j])
      }
    }

    j = list.length
    while (j--) {
      delEdge(net, list[j])
    }

    delete nm[nodeid(n)]
    delete nmimg[nodeid(n)]

    j = nodes.length
    while (--j > n.pos) {
      --nodes[j].pos
      --nodes[j].index
    }
    nodes.splice(n.pos, 1)

    j = net.helper_nodes.length
    while (--j > img.pos) {
      --net.helper_nodes[j].pos
      --net.helper_nodes[j].index
    }
    net.helper_nodes.splice(img.pos, 1)

    n.first_link = null
    n.first_link_target = null
  }

  let network = function (data) {
    let links = [] // OUTPUT LINKS
    let helperLinks = [] // HELPER FORCE GRAPH LINKS
    let helperRenderLinks = [] // HELPER FORCE GRAPH LINKS
    let k

    let net = {
      nodes: nodes,
      links: links,
      helper_nodes: helperNodes,
      helper_links: helperLinks,
      helper_render_links: helperRenderLinks,
      eadd: function (e) {
        addEdge(net, e)
        net.force1.start()
        net.force2.start()
        net.update()
      },
      vadd: function (v) {
        addVertex(net, v)
        net.force1.start()
        net.force2.start()
        net.update()
      },
      edel: function (e) {
        delEdge(net, e)
        net.force1.start()
        net.force2.start()
        net.update()
      },
      vdel: function (v) {
        delVertex(net, v)
        net.force1.start()
        net.force2.start()
        net.update()
      },
      uuid: uuid
    }

    // DETERMINE NODES
    for (k = 0; k < data.nodes.length; ++k) {
      addVertex(net, data.nodes[k])
    }

    // DETERMINE LINKS
    for (k = 0; k < data.links.length; ++k) {
      addEdge(net, data.links[k])
    }

    return net
  }

  // ==

  // SVG ELEMENTS TOOLS

  let vsvg = function (net) {
    if (debug && debug < 3) {
      hnode = helperNodeg
        .selectAll('.node')
        .data(
          net.helper_nodes,
          function (d) { return d.id }
        )

      hnode.exit().remove()
      hnodeVsvg(hnode.enter())
    }

    let node = nodeg.selectAll('.node').data(net.nodes, function (d) {
      return nodeid(d)
    })
    node.exit().remove()
    nodegVsvg(node.enter())
    return node
  }

  let hnodeVsvg = function (enter) {
    enter.append('circle')
      .attr('class', 'node helper')
      .attr('r', function (d) { return 2 })
      .attr('cx', function (d) { return d.x })
      .attr('cy', function (d) { return d.y })
      .style('fill', function (_, i) { return fill(i) })
  }

  let nodegVsvg = function (enter) {
    let g = enter.append('g')
      .attr('class', 'node leaf')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)

    g.append('circle')
      .attr('r', function (d) { return radius + 1 })
      .style('fill', function (_, i) { return fill(i) })

    g.append('text')
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('fill', 'white')
      .text((d) => d.name)
  }

  let esvg = function (net) {
    if (debug === 1 || debug === '1') {
      link = linkg.selectAll('line.link').data(net.links, function (d) {
        return linkid(d)
      })
      link.exit().remove()
      link.enter().append('line')
        .attr('class', 'link')
        .attr('x1', function (d) { return d.source.x })
        .attr('y1', function (d) { return d.source.y })
        .attr('x2', function (d) { return d.target.x })
        .attr('y2', function (d) { return d.target.y })

      link.style('stroke-width', option.stroke)
        .attr('fill', option.path_fill)
        .attr('stroke', option.path_stroke)
    }

    hlink = helperLinkg.selectAll('path.hlink').data(
      net.helper_render_links,
      function (d) { return d.id }
    )
    hlink.exit().remove()
    hlink.enter().append('path').attr('class', 'hlink')
    hlink.style('stroke-width', option.stroke)
      .attr('fill', option.path_fill)
      .attr('stroke', option.path_stroke)

    etext = edgeText.selectAll('text').data(
      net.helper_render_links,
      function (d) { return d.id }
    )
    etext.exit().remove()
    etext.enter().append('text')
      .attr('text-anchor', 'middle')
      .text(function (d) { return d.distance || '' })
  }

  // UPDATE DRAWING

  let update = function (net, force1, force2) {
    // UPDATE SVG ELEMENTS
    esvg(net)
    let node = vsvg(net)
    // let power

    node.call(force1.drag)

    let dragInProgress = false
    let changeSquared = width * height

    // CPU LOAD REDUX FOR THE FIX, PART 3: JUMPSTART THE ANNEALING PROCESS AGAIN WHEN THE USER MOVES THE MOUSE OUTSIDE THE NODE,
    // WHEN WE BELIEVE THE DRAG IS STILL GOING ON; EVEN WHEN IT ISN'T ANYMORE, BUT D3 DOESN'T INFORM US ABOUT THAT!
    node.on('mouseout.ger_fix', function (d) {
      if (debug === 1 || debug === '1') {
        console.log(
          'mouseout.ger_fix', this,
          arguments, d.fixed,
          dragInProgress
        )
      }

      if (dragInProgress) {
        force1.resume()
      }
    })

    let resumeThreshold = 0.05

    force1.on('tick', function (e) {
      if (debug) {
        alphaTrace.push(alphaScale(e.alpha))
        if (alphaTrace.length > width) {
          alphaTrace.shift()
        }
        pathTraceAlpha.attr('d', alphaLine(alphaTrace))

        c2Trace.push(c2Scale(changeSquared))
        if (c2Trace.length > width) {
          c2Trace.shift()
        }
        pathTraceC2.attr('d', c2Line(c2Trace))
      }

      /*
      Force all nodes with only one link to point outwards.

      To do this, we first calculate the center mass (okay, we wing it, we fake node 'weight'),
      then see whether the target node for links from single-link nodes is closer to the
      center-of-mass than us, and if it isn't, we push the node outwards.
      */
      let center = {
        x: width / 2,
        y: height / 2,
        weight: 0
      }
      let centroids = { x: 0, y: 0, weight: 0 }
      let gc = centroids
      let size
      // let c
      // let k
      let mx
      let my
      let dx
      let dy
      let alpha

      dragInProgress = false
      net.nodes.forEach(function (n) {
        let w = Math.max(1, n.size || 0, n.weight || 0)

        center.x += w * n.x
        center.y += w * n.y
        center.weight += w

        gc.x += w * n.x
        gc.y += w * n.y
        gc.weight += w

        if (n.fixed & 2) {
          dragInProgress = true
        }
      })

      size = force1.size()

      mx = size[0] / 2
      my = size[1] / 2

      gc.x /= gc.weight
      gc.y /= gc.weight

      // MOVE THE ENTIRE GRAPH SO THAT ITS CENTER OF MASS SITS AT THE CENTER, PERIOD.
      center.x /= center.weight || 1
      center.y /= center.weight || 1

      if (debug === 1 || debug === '1') {
        centerOfMass
          .attr('cx', center.x)
          .attr('cy', center.y)
      }

      dx = mx - center.x
      dy = my - center.y

      alpha = e.alpha * 5
      dx *= alpha
      dy *= alpha

      net.nodes.forEach(function (n) {
        n.x += dx
        n.y += dy
      })

      changeSquared = 0

      // FIXUP .PX/.PY SO DRAG BEHAVIOUR AND ANNEALING GET THE CORRECT VALUES, AS
      // FORCE.TICK() WOULD EXPECT .PX AND .PY TO BE THE .X AND .Y OF YESTERDAY.
      net.nodes.forEach(function (n) {
        // RESTRAIN ALL NODES TO WINDOW AREA
        let k
        let dx
        let dy
        /* styled border outer thickness and a bit */
        let r = (n.size > 0 ? n.size + radius : radius + 1) + 2

        dx = 0
        if (n.x < r) {
          dx = r - n.x
        } else if (n.x > size[0] - r) {
          dx = size[0] - r - n.x
        }

        dy = 0
        if (n.y < r) {
          dy = r - n.y
        } else if (n.y > size[1] - r) {
          dy = size[1] - r - n.y
        }

        k = 1.2

        n.x += dx * k
        n.y += dy * k
        // RESTRAINING COMPLETED.......................

        // FIXES 'ELUSIVE' NODE BEHAVIOUR WHEN HOVERING WITH THE MOUSE (RELATED TO FORCE.DRAG)
        if (n.fixed) {
          // 'ELUSIVE BEHAVIOUR' ~ MOVE MOUSE NEAR NODE AND NODE WOULD TAKE OFF, I.E. ACT AS AN ELUSIVE CREATURE.
          n.x = n.px
          n.y = n.py
        }
        n.px = n.x
        n.py = n.y

        // PLUS COPY FOR FASTER STOP CHECK
        changeSquared += (n.qx - n.x) * (n.qx - n.x)
        changeSquared += (n.qy - n.y) * (n.qy - n.y)
        n.qx = n.x
        n.qy = n.y
      })

      // ALSO RESTRAIN HELPER NODES TO WITHIN THE VISIBLE AREA --> LINK PATHS ARE ALMOST ALWAYS KET IN-VIEW:
      net.helper_nodes.forEach(function (n) {
        // RESTRAIN ALL NODES TO WINDOW AREA
        let k
        let dx
        let dy
        let r = (n.size > 0 ? n.size : 1) + 5 /* heuristic */

        dx = 0
        if (n.x < r) {
          dx = r - n.x
        } else if (n.x > size[0] - r) {
          dx = size[0] - r - n.x
        }

        dy = 0
        if (n.y < r) {
          dy = r - n.y
        } else if (n.y > size[1] - r) {
          dy = size[1] - r - n.y
        }

        k = 1.2

        n.x += dx * k
        n.y += dy * k
        // RESTRAINING COMPLETED.......................

        n.px = n.x
        n.py = n.y

        // PLUS COPY FOR FASTER STOP CHECK
        changeSquared += (n.qx - n.x) * (n.qx - n.x)
        changeSquared += (n.qy - n.y) * (n.qy - n.y)
        n.qx = n.x
        n.qy = n.y
      })

      if (!isFinite(changeSquared)) {
        changeSquared = width * height
      }

      // KICK THE FORCE2 TO ALSO DO A BIT OF ANNEALING ALONGSIDE:
      // TO MAKE IT DO SOMETHING, WE NEED TO SURROUND IT ALPHA-TWEAKING STUFF, THOUGH.
      force2.resume()
      force2.tick()
      force2.stop()

      // FAST STOP + THE DRAG FIX, PART 2:
      if (changeSquared < option.fast_stop_threshold) {
        if (debug === 1 || debug === '1') {
          console.log('fast stop: CPU load redux')
        }
        force1.stop()
        // FIX PART 4: MONITOR D3 RESETTING THE DRAG MARKER:
        if (dragInProgress) {
          if (debug === 1 || debug === '1') {
            console.log('START monitor drag in progress', dragInProgress)
          }
          d3.timer(function () {
            dragInProgress = false
            net.nodes.forEach(function (n) {
              if (n.fixed & 2) {
                dragInProgress = true
              }
            })
            force1.resume()
            if (debug === 1 || debug === '1') {
              console.log('monitor drag in progress: drag ENDED', dragInProgress)
            }
            // QUIT MONITORING AS SOON AS WE NOTICED THE DRAG ENDED.
            // NOTE: WE CONTINUE TO MONITOR AT +500MS INTERVALS BEYOND THE LAST TICK
            //       AS THIS TIMER FUNCTION ALWAYS KICKSTARTS THE FORCE LAYOUT AGAIN
            //       THROUGH FORCE.RESUME().
            //       D3.TIMER() API ONLY ACCEPTS AN INITIAL DELAY; WE CAN'T SET THIS
            //       THING TO SCAN, SAY, EVERY 500MSECS UNTIL THE DRAG IS DONE,
            //       SO WE DO IT THAT WAY, VIA THE REVIVED FORCE.TICK PROCESS.
            return true
          }, 500)
        }
      } else if (changeSquared > net.nodes.length * 0.1 * resumeThreshold && e.alpha < resumeThreshold) {
        // JOLT THE ALPHA (AND THE VISUAL) WHEN THERE'S STILL A LOT OF CHANGE WHEN WE HIT THE ALPHA THRESHOLD.
        force1.alpha(e.alpha *= 2) // FORCE.RESUME(), BUT NOW WITH DECREASING ALPHA STARTING VALUE SO THE JOLTS DON'T GET SO BIG.

        // AND 'DAMPEN OUT' THE TRIGGER POINT, SO IT BECOMES HARDER AND HARDER TO TRIGGER THE THRESHOLD.
        // THIS IS DONE TO COPE WITH THOSE INSTABLE (FOREVER ROTATING, ETC.) LAYOUTS...
        resumeThreshold *= 0.75
      }

      // --------------------------------------------------------------------

      if (debug === 1 || debug === '1') {
        link
          .attr('x1', (d) => d.source.x)
          .attr('y1', (d) => d.source.y)
          .attr('x2', (d) => d.target.x)
          .attr('y2', (d) => d.target.y)
      }

      node
        .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
        .attr('__name__', (d) => d.name)
    })

    force2.on('tick', function (e) {
      /*
      Update all 'real'=fixed nodes.
      */
      net.helper_nodes.forEach(function (n) {
        let o
        if (n.fixed) {
          o = n.ref
          n.px = n.x = o.x
          n.py = n.y = o.y
        }
      })
      net.helper_links.forEach(function (l) {
        let o = l.g_ref
        l.distance = o.distance
      })

      // NOTE: FORCE2 IS FULLY DRIVEN BY FORCE(1), BUT STILL THERE'S NEED FOR 'FAST STOP' HANDLING IN HERE
      //       AS OUR FORCE2 MAY BE MORE 'JOYOUS' IN ANIMATING THE LINKS THAT FORCE IS ANIMATING THE NODES
      //       THEMSELVES. HENCE WE ALSO TAKE THE DELTA MOVEMENT OF THE HELPER NODES INTO ACCOUNT!
      net.helper_nodes.forEach(function (n) {
        // SKIP THE 'FIXED' BUGGERS: THOSE ARE ALREADY ACCOUNTED FOR IN FORCE.TICK!
        if (n.fixed) {
          return
        }

        // PLUS COPY FOR FASTER STOP CHECK
        changeSquared += (n.qx - n.x) * (n.qx - n.x)
        changeSquared += (n.qy - n.y) * (n.qy - n.y)
        n.qx = n.x
        n.qy = n.y
      })
      if (!isFinite(changeSquared)) {
        changeSquared = width * height
      }

      // --------------------------------------------------------------------

      let logged = false

      hlink.attr('d', function (d) {
        if (isFinite(d.real_source.x)) {
          let linedata
          let dx
          let dy
          // let f
          if (d.cyclic) {
            // CONSTRUCT ROUND-ISH BEZIER FROM NODE TO HELPER AND BACK AGAIN:
            dx = d.target.x - d.real_source.x
            dy = d.target.y - d.real_source.y
            linedata = [
              [d.real_source.x, d.real_source.y],
              [
                d.target.x - cycleCurvep * dy,
                d.target.y + cycleCurvep * dx
              ],
              [
                d.target.x + cycleCurvep * dx,
                d.target.y + cycleCurvep * dy
              ],
              [
                d.target.x + cycleCurvep * dy,
                d.target.y - cycleCurvep * dx
              ],
              [d.real_source.x, d.real_source.y]
            ]
            return cyclePathgen(linedata)
          } else {
            linedata = [
              [d.real_source.x, d.real_source.y],
              [d.source.x, d.source.y],
              [d.target.x, d.target.y],
              [d.real_target.x, d.real_target.y]
            ]
            return pathgen(linedata)
          }
        } else {
          if (!logged) {
            console.log('boom')
            logged = true
          }
          return null
        }
      })

      etext
        .attr('y', function (d) { return (d.source.y + d.target.y) / 2 })
        .attr('x', function (d) { return (d.source.x + d.target.x) / 2 })

      if (debug && debug < 3) {
        hnode.attr('cx', function (d) { return d.x })
        .attr('cy', function (d) { return d.y })
      }
    })

    return net
  }

  // INIT DRAWING EVENTS

  let init = function () {
    let net = network(data)

    let force1 = d3.layout.force()
      .nodes(net.nodes)
      .links(net.links)
      .size([width, height])
      .linkDistance(option.force1.distance)
      .gravity(option.force1.gravity)
      .charge(option.force1.charge)
      .friction(option.force1.friction) // FRICTION ADJUSTED TO GET DAMPENED DISPLAY: LESS BOUNCY BOUNCY BALL [SWEDISH CHEF, ANYONE?]
      .start()

    /**
     * AND HERE'S THE CRAZY IDEA FOR ALLOWING AND RENDERING MULTIPLE LINKS BETWEEN 2 NODES, ETC., AS THE INITIAL ATTEMPT
     * TO INCLUDE THE 'HELPER' NODES IN THE BASIC 'FORCE' FAILED DRAMATICALLY FROM A VISUAL POV: WE 'OVERLAY' THE BASIC
     * NODES+LINKS FORCE WITH A SECOND FORCE LAYOUT WHICH 'AUGMENTS' THE ORIGINAL FORCE LAYOUT BY HAVING IT 'LAYOUT' ALL
     * THE HELPER NODES (WITH THEIR LINKS) BETWEEN THE 'FIXED' REAL NODES, WHICH ARE LAID OUT BY THE ORIGINAL FORCE.
     *
     * THIS WAY, WE ALSO HAVE THE FREEDOM TO APPLY A COMPLETELY DIFFERENT FORCE FIELD SETUP TO THE HELPERS (NO GRAVITY
     * AS IT DOESN'T MAKE SENSE FOR HELPERS, DIFFERENT CHARGE VALUES, ETC.).
   */
    let force2 = d3.layout.force()
      .nodes(net.helper_nodes)
      .links(net.helper_links)
      .size([width, height])
      .linkDistance(option.force2.distance)
      .gravity(option.force2.gravity)
      .charge(option.force2.charge)
      .friction(option.force2.friction)
      .start()
      .stop() // AND IMMEDIATELY STOP! FORCE.TICK WILL DRIVE THIS ONE EVERY TICK!

    net.force1 = force1
    net.force2 = force2
    net.update = function () { update(net, force1, force2) }

    net.update()

    return net
  }

  // ==

  // OK, DO IT

  let net = init()

  // ==

  // EVENT HANDLERS

  let setzoom = function (translate, scale) {
    wrap.attr(
      'transform',
      'translate(' + translate[0] + ',' + translate[1] + ')scale(' + scale + ')'
    )
  }

  let zoomed = function () {
    wrap.attr(
      'transform',
      'translate(' + zoom.translate() + ')scale(' + zoom.scale() + ')'
    )
  }

  let zoom = d3.behavior.zoom()
    .scaleExtent(option.zoom_range)
    .on('zoom', zoomed)

  superwrap.call(zoom)
  superwrap.on('dblclick.zoom', null)

  vis.attr('opacity', 1e-6)
    .transition()
    .duration(1000)
    .attr('opacity', 1)

  net.option = option
  net.zoom = setzoom
  net.size = function (s) {
    vis.attr('width', s[0]).attr('height', s[1])
    if (s[0] > 0 || s[1] > 0) {
      superwrap.attr('width', s[0]).attr('height', s[1])
      background.attr('width', s[0]).attr('height', s[1])
      wrap.attr('width', s[0]).attr('height', s[1])
    }
    net.force1.size(s)
    net.force2.size(s)
  }
  return net

  // ==
}

class Graph extends Component {
  constructor (props) {
    super(props)

    this.state = {
      graph: {
        name: 'Loading...',
        adjacencyList: {}
      },
      stabilityRadius: {},
      style: 'none'
    }
    this.isGraphRendered = false
    this.graph = new DirectedGraph()
  }

  componentWillMount () {
    graphService.findById(this.props.params._id)
      .then(graph => {
        if (graph) {
          this.setState({ graph: graph })
          this.graph.setAdjacencyList(graph.adjacencyList)
        }
      })
  }

  addGraph () {
    let w = 650
    let h = 400

    let rootSelector = 'div#graphRoot'
    let option = {
      debug: 0,
      root: rootSelector,
      width: w,
      height: h
    }

    document.querySelector(rootSelector).innerHTML = ''
    let net = dynamicMultigraph(option)

    Object.keys(this.state.graph.adjacencyList).forEach(key => {
      net.vadd({ name: parseInt(key) })
    })

    Object.keys(this.state.graph.adjacencyList).forEach(key => {
      let edges = this.state.graph.adjacencyList[key]
      let keyNum = parseInt(key)
      edges.forEach(edge => {
        if (keyNum < edge.vertex) {
          net.eadd({
            source: net.nodes[keyNum],
            target: net.nodes[edge.vertex],
            weight: edge.weight
          })
        }
      })
    })
  }

  addLineGraph () {
    if (this.state.stabilityRadius.radius === undefined) {
      return
    }

    let width = 650
    let height = 400

    let rootSelector = 'div#lineGraph'
    document.querySelector(rootSelector).innerHTML = ''

    let svg = d3.select(rootSelector)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    this.state.stabilityRadius.segmentPoints.forEach(point => {
      maxX = Math.max(maxX, point.x)
      minX = Math.min(minX, point.x)

      maxY = Math.max(maxY, point.y)
      minY = Math.min(minY, point.y)
    })

    let x = d3.scale.linear().range([0, width - 50])
    let y = d3.scale.linear().range([height - 50, 0])

    x.domain([minX - 3, maxX + 3])
    y.domain([minY - 3, maxY + 3])

    var xAxis = d3.svg.axis().scale(x)
      .orient('bottom')
      .ticks(10)
      .tickSize(-height + 50, 0, 0)

    var yAxis = d3.svg.axis().scale(y)
      .orient('left').ticks(10)
      .tickSize(-width + 50, 0, 0)

    var line = d3.svg.line()
      .interpolate('linear')
      .x((d) => x(d.x))
      .y((d) => y(d.y))

    svg.append('path')
      .attr('class', 'line')
      .attr('transform', 'translate(40, 10)')
      .attr('d', line(this.state.stabilityRadius.segmentPoints))
      .attr('fill', 'none')
      .attr('stroke', 'red')
      .style('stroke-width', 2)

    let a = this.state.stabilityRadius.mstLine.a
    let b = this.state.stabilityRadius.mstLine.b
    let mstLine = [
      { x: minX, y: a + b * minX },
      { x: maxX, y: a + b * maxX }
    ]
    svg.append('path')
      .attr('class', 'line')
      .attr('transform', 'translate(40, 10)')
      .attr('d', line(mstLine))
      .attr('fill', 'none')
      .attr('stroke', 'green')
      .style('stroke-width', 2)

    // Add the X Axis
    svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(40, ${height - 40})`)
      .call(xAxis)
    .append('text')
      .attr('y', -15)
      .attr('x', 540)
      .attr('dy', '0.71em')
      .style('font-size', '14px')
      .style('fill', '#1D1DAF')
      .text('Deviation')

    svg.append('g')
      .attr('class', 'y axis')
      .attr('transform', 'translate(40, 10)')
      .call(yAxis)
    .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('x', -45)
      .attr('dy', '0.71em')
      .style('font-size', '14px')
      .style('fill', '#1D1DAF')
      .text('Weight')
  }

  componentDidUpdate () {
    if (!this.isGraphRendered) {
      this.addGraph()
    }
    this.addLineGraph()

    if (Object.keys(this.state.graph.adjacencyList).length) {
      this.isGraphRendered = true
    }
  }

  goToList () {
    this.props.router.replace('graphs')
  }

  calculateRadius () {
    let stabilityRadius = StabilyRadii.calculate(this.graph)
    this.setState({ stabilityRadius })
  }

  renderStabilityRadius () {
    if (this.state.stabilityRadius.radius === undefined) {
      return ''
    }

    return (
      <div>
        Stability radius: {this.state.stabilityRadius.radius}

        <div id='lineGraph' className={styles.lineGraph}>Line Graph</div>
      </div>
    )
  }

  setMST () {
    if (!this.mst) {
      this.mst = PrimeAlgorithm.mst(this.graph)
    }

    this.setState({ style: 'mst' })

    let edges = d3.selectAll('.hlink')
    edges[0].forEach(edge => {
      let source = edge.__data__.real_source.name
      let target = edge.__data__.real_target.name
      let isMST = this.mst.edges.some(mstEdge => {
        return (mstEdge.start === source && mstEdge.end === target) ||
          (mstEdge.end === source && mstEdge.start === target)
      })

      if (isMST) {
        d3.select(edge).style('stroke', '#4D3FCA')
      } else {
        d3.select(edge).style('stroke', '#5CDACC')
      }
    })
  }

  setSecondMST () {
    if (!this.mst) {
      this.mst = PrimeAlgorithm.mst(this.graph)
    }

    if (!this.secondMst) {
      this.secondMst = SecondMST.secondMST(this.graph, this.mst)
    }

    this.setState({ style: 'secondMst' })

    let edges = d3.selectAll('.hlink')
    edges[0].forEach(edge => {
      let source = edge.__data__.real_source.name
      let target = edge.__data__.real_target.name
      let isMST = this.secondMst.edges.some(mstEdge => {
        return (mstEdge.start === source && mstEdge.end === target) ||
          (mstEdge.end === source && mstEdge.start === target)
      })

      if (isMST) {
        d3.select(edge).style('stroke', '#4D3FCA')
      } else {
        d3.select(edge).style('stroke', '#5CDACC')
      }
    })
  }

  removeStyles () {
    d3.selectAll('.hlink').style('stroke', '#5CDACC')
    this.setState({ style: 'none' })
  }

  graphInfo () {
    switch (this.state.style) {
      case 'none':
        return ''
      case 'mst':
        return (
          <div>Minimum spanning tree weight: {this.mst.weight}</div>
        )
      case 'secondMst':
        return (
          <div>Second minimum spanning tree weight: {this.secondMst.weight}</div>
        )
    }
  }

  render () {
    return (
      <div>
        <h1>{this.state.graph.name}</h1>
        <span className={styles.goBack} onClick={this.goToList.bind(this)}>
          Go to list of graphs
        </span>

        <div id='graphRoot'>Graph</div>

        {this.graphInfo()}

        <ol className={styles.actions}>
          <li onClick={this.setMST.bind(this)}>Mark edges of the minimum spanning tree</li>
          <li onClick={this.setSecondMST.bind(this)}>Mark second minimum spanning tree</li>
          <li onClick={this.removeStyles.bind(this)}>Remove all marks</li>
        </ol>

        <span className={styles.goBack} onClick={this.calculateRadius.bind(this)}>
          Calculate stability radius
        </span>

        {this.renderStabilityRadius()}
      </div>
    )
  }
}

export default withRouter(Graph)
