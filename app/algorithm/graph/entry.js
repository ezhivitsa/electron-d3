class Entry {
  constructor (elem, priority) {
    this.mDegree = 0       // Number of children
    this.mIsMarked = false // Whether this node is marked

    this.mNext = this   // Next and previous elements in the list
    this.mPrev = this

    this.mParent = null // Parent in the tree, if any.

    this.mChild = null  // Child node, if any.

    this.mElem = elem     // Element being stored here
    this.mPriority = priority
  }

  getValue () {
    return this.mElem
  }

  setValue (value) {
    this.mElem = value
  }

  getPriority () {
    return this.mPriority
  }
}

export default Entry
