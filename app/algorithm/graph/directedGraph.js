import Graph from './graph'

class DirectedGraph extends Graph {
  addEdge (start, end, weight) {
    this.addToAdjacencyList(start, end, weight)

    this.weight += weight

    this.edges.push({
      start: start,
      end: end,
      weight: weight
    })
  }
}

export default DirectedGraph
