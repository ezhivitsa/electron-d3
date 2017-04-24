import Graph from '../graph/graph'
import FibonacciHeap from '../graph/fibonacciHeap'

class Algorithm {
  static mst (graph) {
    let pq = new FibonacciHeap()
    let result = new Graph()

    let entries = {}
    if (graph.isEmpty()) {
      return result
    }

    let startNode = 0
    result.addNode(startNode)

    this.addOutgoingEdges(startNode, graph, pq, result, entries)
    /* Now, until we have added |V| - 1 edges to the graph, continously
    * pick a node and determine which edge to add.
    */
    for (let i = 0; i < graph.size - 1; i++) {
      /* Grab the cheapest node we can add. */
      let toAdd = pq.dequeueMin().mElem

      /* Determine which edge we should pick to add to the MST.  We'll
      * do this by getting the endpoint of the edge leaving the current
      * node that's of minimum cost and that enters the visited edges.
      */
      let endpoint = this.minCostEndpoint(toAdd, graph, result)

      /* Add this edge to the graph. */
      result.addNode(toAdd)
      result.addEdge(toAdd, endpoint, graph.edgeCost(toAdd, endpoint))

      /* Explore outward from this node. */
      this.addOutgoingEdges(toAdd, graph, pq, result, entries)
    }

    /* Hand back the generated graph. */
    return result
  }

  /**
   * Given a node in the source graph and a set of nodes that we've visited
   * so far, returns the minimum-cost edge from that node to some node that
   * has been visited before.
   *
   * @param node The node that has not been considered yet.
   * @param graph The original graph whose MST is being computed.
   * @param result The resulting graph, used to check what has been visited
   *               so far.
   */
  static minCostEndpoint (node, graph, result) {
    /* Track the best endpoint so far and its cost, initially null and
    * +infinity.
    */
    let endpoint = null
    let leastCost = Infinity

    /* Scan each node, checking whether it's a candidate. */
    graph.edgesFrom(node).forEach((entry) => {
      if (result.containsNode(entry.vertex)) {
        if (entry.weight < leastCost) {
          endpoint = entry.vertex
          leastCost = entry.weight
        }
      }
    })

    /* Hand back the result.  We're guaranteed to have found something,
    * since otherwise we couldn't have dequeued this node.
    */
    return endpoint
  }

  static addOutgoingEdges (node, graph, pq, result, entries) {
    graph.edgesFrom(node).forEach((edge) => {
      if (!result.containsNode(edge.vertex)) {
        if (!entries[edge.vertex]) {
          entries[edge.vertex] = pq.enqueue(edge.vertex, edge.weight)
        } else if (entries[edge.vertex].mPriority > edge.weight) {
          pq.decreaseKey(entries[edge.vertex], edge.weight)
        }
      }
    })
  }
}

export default Algorithm
