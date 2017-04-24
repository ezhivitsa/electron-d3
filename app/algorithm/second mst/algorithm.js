import HeavyLightDecomposition from '../heavy light decomposition/algorithm'
import GraphHelpers from '../graph/helpers'

class SecondMST {
  static secondMST (graph, mst) {
    mst = GraphHelpers.copy(mst)

    let directedMst = GraphHelpers.getDirectedGraph(mst, 0)
    let edges = {}
    let edgesList = []

    for (let i = 0; i < graph.adjacencyList.length; i += 1) {
      if (graph.adjacencyList[i] instanceof Array) {
        graph.adjacencyList[i].forEach((edge) => {
          let end = edge.vertex
          let weight = edge.weight

          if (!mst.isExistEdge(i, end) && (!edges[i] || !edges[i][end]) && (!edges[end] || !edges[end][i])) {
            edges[i] = edges[i] || {}
            edges[i][end] = weight
            edgesList.push({
              start: i,
              end: end,
              weight: weight
            })
          }
        })
      }
    }

    let hld = new HeavyLightDecomposition(directedMst)
    hld.decomposition()

    let minWeight = Infinity
    let edgeToAdd = null
    let edgeToRemove = null
    edgesList.forEach(function (edge) {
      let maxEdge = SecondMST.maxEdgeInCycle(hld, edge)

      if (edge.weight - maxEdge.weight < minWeight) {
        edgeToAdd = edge
        edgeToRemove = maxEdge
        minWeight = edge.weight - maxEdge.weight
      }
    })
    mst.addEdge(edgeToAdd.start, edgeToAdd.end, edgeToAdd.weight)
    mst.removeEdge(edgeToRemove.start, edgeToRemove.end)

    return mst
  }

  static maxEdgeInCycle (hld, edgeToAdd) {
    return hld.maxEdge(edgeToAdd.start, edgeToAdd.end)
  }
}

export default SecondMST
