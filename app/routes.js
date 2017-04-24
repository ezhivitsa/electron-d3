// @flow
import React from 'react'
import { Route, IndexRoute } from 'react-router'
import App from './containers/App'

import GraphsPage from './containers/GraphsPage'
import GraphPage from './containers/GraphPage'

export default (
  <Route path='/' component={App}>
    <IndexRoute component={GraphsPage} />
    <Route path='graphs' component={GraphsPage} />
    <Route path='graphs/:_id' component={GraphPage} />
  </Route>
)
