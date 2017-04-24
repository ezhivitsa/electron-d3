class Graph {
  constructor (size) {
    size = size || 0
    this.size = 0
    this.adjacencyList = []
    this.edges = []
    this.weight = 0

    for (let i = 0; i < size; i++) {
      this.addNode(i)
    }
  }

  setAdjacencyList (list) {
    for (let i = 0; i < Object.keys(list).length; i++) {
      this.addNode(i)
    }

    Object.keys(list).forEach(key => {
      let edges = list[key]
      let keyNum = parseInt(key)
      edges.forEach(edge => {
        if (keyNum < edge.vertex) {
          this.addEdge(keyNum, edge.vertex, edge.weight)
        }
      })
    })
  }

  addNode (node) {
    if (!this.containsNode(node)) {
      this.adjacencyList[node] = []
      this.size++
    }
  }

  addEdge (start, end, weight) {
    this.addToAdjacencyList(start, end, weight)
    this.addToAdjacencyList(end, start, weight)

    this.weight += weight

    this.edges.push({
      start: start,
      end: end,
      weight: weight
    })

    return this
  }

  addToAdjacencyList (start, end, weight) {
    if (this.adjacencyList[start] instanceof Array && this.adjacencyList[end] instanceof Array) {
      this.adjacencyList[start].push({
        vertex: end,
        weight: weight
      })
    }
  }

  removeEdge (one, two) {
    let weight = this.removeFromAdjacencyList(one, two)
    this.removeFromAdjacencyList(two, one)

    for (let i = 0; i < this.edges.length; i += 1) {
      if ((this.edges[i].start === one && this.edges[i].end === two) ||
        (this.edges[i].start === two && this.edges[i].end === one)) {
        this.edges.splice(i, 1)
        break
      }
    }
    this.weight -= weight
  }

  removeFromAdjacencyList (one, two) {
    for (let i = 0; i < this.adjacencyList[one].length; i += 1) {
      if (this.adjacencyList[one][i].vertex === two) {
        let weight = this.adjacencyList[one][i].weight
        this.adjacencyList[one].splice(i, 1)
        return weight
      }
    }
  }

  isExistEdge (start, end) {
    if (this.adjacencyList[start]) {
      return this.adjacencyList[start].some(vert => (vert.vertex - end === 0))
    } else {
      return false
    }
  }

  edgeCost (one, two) {
    for (let i = 0; i < this.adjacencyList[one].length; i += 1) {
      if (this.adjacencyList[one][i].vertex === two) {
        return this.adjacencyList[one][i].weight
      }
    }
  }

  edgesFrom (vertexNum) {
    return this.adjacencyList[vertexNum]
  }

  containsNode (vertexNum) {
    return this.adjacencyList[vertexNum] instanceof Array
  }

  getNodes () {
    let nodes = []
    for (let i = 0; i < this.adjacencyList.length; i += 1) {
      if (this.adjacencyList[i] instanceof Array) {
        nodes.push(i)
      }
    }
    return nodes
  }

  isEmpty () {
    return this.adjacencyList.length === 0
  }

  update (start, end, weight) {
    let edge = this.findEdge(start, end)
    if (edge) {
      edge.weight = weight
    }
  }

  findEdge (start, end) {
    for (let i = 0; i < this.adjacencyList.length; i += 1) {
      if (this.adjacencyList[i] instanceof Array) {
        for (let j = 0; j < this.adjacencyList[i].length; j += 1) {
          if (i === start && this.adjacencyList[i][j].vertex === end) {
            return this.adjacencyList[i][j]
          }
        }
      }
    }
  }

  print () {
    let template = ''
    let string = this.edges.reduce((template, edge) => {
      return template + `<li><span>${edge.start}</span> -> <span>${edge.end}</span> : <span>${edge.weight}</span></li>\n`
    }, template)

    return `<ul>${string}</ul>`
  }
}

export default Graph
