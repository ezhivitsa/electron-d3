import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import Graph from '../components/graph'
import * as GraphActions from '../actions/graph'

const mapStateToProps = (state) => {
  return {}
}

const mapDispatchToProps = (dispatch) => {
  return bindActionCreators(GraphActions, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Graph)
