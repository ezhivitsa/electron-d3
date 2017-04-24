import Graph from '../graph/graph'
import PrimeAlgorithm from '../prim/algorithm'
import SecondMST from '../second mst/algorithm'
import Helpers from '../graph/helpers'

class StabilyRadii {
  static calculate (graph) {
    let edges = graph.edges

    let mst = PrimeAlgorithm.mst(graph)

    let d = []
    let c = []
    edges.forEach((edge, i) => {
      if (mst.isExistEdge(edge.start, edge.end)) {
        d[i] = -1
      } else {
        d[i] = 1
      }
      c[i] = edge.weight
    })

    let norm = Math.max.apply(null, c)

    let line1 = StabilyRadii.getLine(c, d, 0, mst, graph)
    let line2 = StabilyRadii.getLine(c, d, norm, mst, graph)

    let segmentPoints = []
    StabilyRadii.insertPoints(segmentPoints, line1, norm)
    StabilyRadii.insertPoints(segmentPoints, line2, norm)

    /**
    * start the same algorithm for each of the currently added new points
    */
    StabilyRadii.addPoints(c, d, segmentPoints, mst, graph)

    let mstLine = StabilyRadii.getLine(c, d, 0, mst, graph, true)
    let intersectionPoint = StabilyRadii.getIntersectionPoint(segmentPoints, mstLine)

    if (intersectionPoint) {
      return {
        segmentPoints,
        mstLine,
        radius: intersectionPoint.x
      }
    } else {
      return "Stability radius doesn't exist"
    }
  }

  static getIntersectionPoint (segmentPoints, line) {
    for (let i = 0; i < segmentPoints.length - 1; i += 1) {
      let p1 = segmentPoints[i]
      let p2 = segmentPoints[i + 1]

      let p3 = StabilyRadii.getPoint(line, p1.x)
      let p4 = StabilyRadii.getPoint(line, p2.x)

      if (StabilyRadii.isIntersect(p1, p2, p3, p4)) {
        let lineByPoints = StabilyRadii.getLineByPoints(p1, p2)
        let newPoint = StabilyRadii.intersectionPoint(lineByPoints, line)
        return newPoint
      }
    }
  }

  static addPoints (c, d, segmentPoints, mst, graph) {
    let isAdded = false

    for (let i = 0; i < segmentPoints.length - 1; i += 1) {
      if (segmentPoints[i].isNew) {
        segmentPoints[i].isNew = false
        segmentPoints[i].isNewAdded = true
      }
    }

    for (let i = 0; i < segmentPoints.length - 1; i += 1) {
      if (segmentPoints[i].isNewAdded) {
        segmentPoints[i].isNewAdded = false

        let newLine = StabilyRadii.getLine(c, d, segmentPoints[i].x, mst, graph)
        StabilyRadii.insertPoints(segmentPoints, newLine)
        isAdded = true
        i = 0
      }
    }

    if (isAdded) {
      StabilyRadii.addPoints(c, d, segmentPoints, mst, graph)
    }
  }

  static insertPoints (segmentPoints, line, norm) {
    if (segmentPoints.length >= 2) {
      let intersections = []

      for (let i = 0; i < segmentPoints.length - 1; i += 1) {
        let p1 = segmentPoints[i]
        let p2 = segmentPoints[i + 1]

        let p3 = StabilyRadii.getPoint(line, p1.x)
        let p4 = StabilyRadii.getPoint(line, p2.x)

        p3.line = line
        if (StabilyRadii.isIntersect(p1, p2, p3, p4)) {
          let lineByPoints = StabilyRadii.getLineByPoints(p1, p2)
          let newPoint = StabilyRadii.intersectionPoint(lineByPoints, line)

          if (newPoint === 'all') {
            intersections.push('all')
            break
          } else {
            newPoint.isNew = true
            intersections.push({
              index: i,
              point: newPoint
            })
          }
        }
      }

      if (intersections.indexOf('all') === -1) {
        intersections = StabilyRadii.removeDublicates(intersections)
        if (intersections.length === 2) {
          let start = intersections[0].index
          let end = intersections[1].index
          segmentPoints.splice(start + 1, end - start, intersections[0].point, intersections[1].point)
        } else if (intersections.length === 1) {
          let startPoint = StabilyRadii.getPoint(line, segmentPoints[0].x)
          let endPoint = StabilyRadii.getPoint(line, segmentPoints[segmentPoints.length - 1].x)

          if (startPoint.y < segmentPoints[0].y) {
            segmentPoints.splice(0, intersections[0].index + 1, startPoint, intersections[0].point)
          } else if (endPoint.y < segmentPoints[segmentPoints.length - 1].y) {
            segmentPoints.splice(
              intersections[0].index + 1,
              segmentPoints.length - intersections[0].index - 1,
              intersections[0].point, endPoint
            )
          }
        }

        for (let i = 0; i < segmentPoints.length - 1; i += 1) {
          if (Math.abs(segmentPoints[i].x - segmentPoints[i + 1].x) < Number.EPSILON * 10) {
            if (segmentPoints[i].isNew) {
              segmentPoints.splice(i, 1)
            } else if (segmentPoints[i + 1].isNew) {
              segmentPoints.splice(i + 1, 1)
            }
            i -= 1
          }
        }
      }
    } else {
      let p1 = StabilyRadii.getPoint(line, 0)
      let p2 = StabilyRadii.getPoint(line, norm)

      p1.line = line
      segmentPoints.push(p1)
      segmentPoints.push(p2)
    }
  }

  static removeDublicates (array) {
    for (let i = 0; i < array.length - 1; i += 1) {
      if (Math.abs(array[i].point.x + array[i + 1].point.x) < Number.EPSILON * 10) {
        array.splice(i + 1, 1)
        i -= 1
      }
    }

    return array
  }

  static getLine (c, d, p, mst, graph, isMstLine) {
    let newGraph = new Graph(graph.size)

    graph.edges.forEach((edge, i) => {
      newGraph.addEdge(edge.start, edge.end, c[i] - d[i] * p)
    })

    let newMST = mst
    if (!isMstLine) {
      newMST = PrimeAlgorithm.mst(newGraph)
      if (Helpers.isEqual(newMST, mst)) {
        newMST = SecondMST.secondMST(newGraph, newMST)
      }
    }

    let line = { a: 0, b: 0 }
    graph.edges.forEach((edge, i) => {
      let x = 0
      if (newMST.isExistEdge(edge.start, edge.end)) {
        x = 1
      }
      line.a += c[i] * x
      line.b += -d[i] * x
    })
    return line
  }

  static isIntersect (p1, p2, p3, p4) {
    let x1 = p1.x
    let y1 = p1.y
    let x2 = p2.x
    let y2 = p2.y
    let x3 = p3.x
    let y3 = p3.y
    let x4 = p4.x
    let y4 = p4.y

    if (((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)) * ((x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1)) > 0) {
      return false
    } else if (((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) * ((x4 - x1) * (y2 - y3) - (y4 - y3) * (x2 - x3)) > 0) {
      return false
    } else {
      return true
    }
  }

  static intersectionPoint (line1, line2) {
    if (Math.abs(line2.b - line1.b) > Number.EPSILON * 10) {
      let x = (line1.a - line2.a) / (line2.b - line1.b)
      let y = line1.a + line1.b * x
      return { x: x, y: y }
    } else {
      return 'all'
    }
  }

  static getPoint (line, x) {
    return { x: x, y: line.a + line.b * x }
  }

  static getLineByPoints (p1, p2) {
    let result = { a: 0, b: 0 }
    result.b = (p2.y - p1.y) / (p2.x - p1.x)
    result.a = -result.b * p1.x + p1.y
    return result
  }
}

export default StabilyRadii
