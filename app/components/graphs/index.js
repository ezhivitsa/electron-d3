// @flow
import React, { Component } from 'react'
import { withRouter } from 'react-router'

import styles from './styles.css'

import graphService from '../../server/resources/graphs/graphs.service'

class Graphs extends Component {
  constructor (props) {
    super(props)

    this.state = {
      graphs: graphService.defaultGraphs()
    }
  }

  componentWillMount () {
    graphService.list()
      .then(graphs => {
        this.setState({ graphs: graphs.results })
      })
  }

  goToGraph (id) {
    this.props.router.replace(`graphs/${id}`)
  }

  graphsList () {
    return this.state.graphs.map(graph => {
      return (
        <li key={graph._id} onClick={this.goToGraph.bind(this, graph._id)}>{graph.name}</li>
      )
    })
  }

  render () {
    return (
      <div>
        <div className={styles.container} data-tid='container'>
          <h2>List of graphs</h2>
          <ol>
            {this.graphsList()}
          </ol>
        </div>
      </div>
    )
  }
}

export default withRouter(Graphs)
