import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import Graphs from '../components/graphs'
import * as GraphsActions from '../actions/graphs'

const mapStateToProps = (state) => {
  return {}
}

const mapDispatchToProps = (dispatch) => {
  return bindActionCreators(GraphsActions, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(Graphs)
