import Entry from './entry'

class FibonacciHeap {
  constructor () {
    this.mMin = null
    this.mSize = 0
  }

  enqueue (value, priority) {
    this.checkPriority(priority)

    /* Create the entry object, which is a circularly-linked list of length
    * one.
    */
    let result = new Entry(value, priority)

    /* Merge this singleton list with the tree list. */
    this.mMin = FibonacciHeap.mergeLists(this.mMin, result)

    /* Increase the size of the heap; we just added something. */
    this.mSize += 1

    /* Return the reference to the new element. */
    return result
  }

  min () {
    return this.mMin
  }

  isEmpty () {
    return this.mMin === null
  }

  static merge (one, two) {
    /* Create a new FibonacciHeap to hold the result. */
    let result = new FibonacciHeap()

    /* Merge the two Fibonacci heap root lists together.  This helper function
    * also computes the min of the two lists, so we can store the result in
    * the mMin field of the new heap.
    */
    result.mMin = FibonacciHeap.mergeLists(one.mMin, two.mMin)

    /* The size of the new heap is the sum of the sizes of the input heaps. */
    result.mSize = one.mSize + two.mSize

    /* Clear the old heaps. */
    one.mSize = two.mSize = 0
    one.mMin = null
    two.mMin = null

    /* Return the newly-merged heap. */
    return result
  }

  static mergeLists (one, two) {
    /* There are four cases depending on whether the lists are null or not.
    * We consider each separately.
    */
    if (one === null && two === null) { // Both null, resulting list is null.
      return null
    } else if (one !== null && two === null) { // Two is null, result is one.
      return one
    } else if (one === null && two !== null) { // One is null, result is two.
      return two
    } else {
      let oneNext = one.mNext // Cache this since we're about to overwrite it.
      one.mNext = two.mNext
      one.mNext.mPrev = one
      two.mNext = oneNext
      two.mNext.mPrev = two

      /* Return a pointer to whichever's smaller. */
      return one.mPriority < two.mPriority ? one : two
    }
  }

  dequeueMin () {
    /* Check for whether we're empty. */
    if (this.isEmpty()) {
      // throw new NoSuchElementException("Heap is empty.");
    }

    /* Otherwise, we're about to lose an element, so decrement the number of
    * entries in this heap.
    */
    this.mSize -= 1

    /* Grab the minimum element so we know what to return. */
    let minElem = this.mMin

    /* Now, we need to get rid of this element from the list of roots.  There
    * are two cases to consider.  First, if this is the only element in the
    * list of roots, we set the list of roots to be null by clearing mMin.
    * Otherwise, if it's not null, then we write the elements next to the
    * min element around the min element to remove it, then arbitrarily
    * reassign the min.
    */
    if (this.mMin.mNext === this.mMin) { // Case one
      this.mMin = null
    } else { // Case two
      this.mMin.mPrev.mNext = this.mMin.mNext
      this.mMin.mNext.mPrev = this.mMin.mPrev
      this.mMin = this.mMin.mNext // Arbitrary element of the root list.
    }

    /* Next, clear the parent fields of all of the min element's children,
    * since they're about to become roots.  Because the elements are
    * stored in a circular list, the traversal is a bit complex.
    */
    if (minElem.mChild != null) {
      /* Keep track of the first visited node. */
      let curr = minElem.mChild
      do {
        curr.mParent = null

        /* Walk to the next node, then stop if this is the node we
        * started at.
        */
        curr = curr.mNext
      } while (curr !== minElem.mChild)
    }

    /* Next, splice the children of the root node into the topmost list,
    * then set mMin to point somewhere in that list.
    */
    this.mMin = FibonacciHeap.mergeLists(this.mMin, minElem.mChild)

    /* If there are no entries left, we're done. */
    if (this.mMin == null) {
      return minElem
    }

    /* Next, we need to coalsce all of the roots so that there is only one
    * tree of each degree.  To track trees of each size, we allocate an
    * ArrayList where the entry at position i is either null or the
    * unique tree of degree i.
    */
    let treeTable = []

    /* We need to traverse the entire list, but since we're going to be
    * messing around with it we have to be careful not to break our
    * traversal order mid-stream.  One major challenge is how to detect
    * whether we're visiting the same node twice.  To do this, we'll
    * spent a bit of overhead adding all of the nodes to a list, and
    * then will visit each element of this list in order.
    */
    let toVisit = []

    /* To add everything, we'll iterate across the elements until we
    * find the first element twice.  We check this by looping while the
    * list is empty or while the current element isn't the first element
    * of that list.
    */
    for (let curr = this.mMin; toVisit.length === 0 || toVisit[0] !== curr; curr = curr.mNext) {
      toVisit.push(curr)
    }

    /* Traverse this list and perform the appropriate unioning steps. */
    toVisit.forEach(curr => {
      /* Keep merging until a match arises. */
      while (true) {
        /* Ensure that the list is long enough to hold an element of this
        * degree.
        */
        while (curr.mDegree >= treeTable.length) {
          treeTable.push(null)
        }

        /* If nothing's here, we're can record that this tree has this size
        * and are done processing.
        */
        if (treeTable[curr.mDegree] === null) {
          treeTable[curr.mDegree] = curr
          break
        }

        /* Otherwise, merge with what's there. */
        let other = treeTable[curr.mDegree]
        treeTable[curr.mDegree] = null // Clear the slot

        /* Determine which of the two trees has the smaller root, storing
        * the two tree accordingly.
        */
        let min = (other.mPriority < curr.mPriority) ? other : curr
        let max = (other.mPriority < curr.mPriority) ? curr : other

        /* Break max out of the root list, then merge it into min's child
        * list.
        */
        max.mNext.mPrev = max.mPrev
        max.mPrev.mNext = max.mNext

        /* Make it a singleton so that we can merge it. */
        max.mNext = max.mPrev = max
        min.mChild = FibonacciHeap.mergeLists(min.mChild, max)

        /* Reparent max appropriately. */
        max.mParent = min

        /* Clear max's mark, since it can now lose another child. */
        max.mIsMarked = false

        /* Increase min's degree; it now has another child. */
        min.mDegree += 1

        /* Continue merging this tree. */
        curr = min
      }

      /* Update the global min based on this node.  Note that we compare
      * for <= instead of < here.  That's because if we just did a
      * reparent operation that merged two different trees of equal
      * priority, we need to make sure that the min pointer points to
      * the root-level one.
      */
      if (curr.mPriority <= this.mMin.mPriority) {
        this.mMin = curr
      }
    })
    return minElem
  }

  checkPriority (priority) {
    if (isNaN(priority)) {
      // throw new IllegalArgumentException(priority + " is invalid.");
    }
  }

  decreaseKey (entry, newPriority) {
    this.checkPriority(newPriority)
    if (newPriority > entry.mPriority) {
      // throw new IllegalArgumentException("New priority exceeds old.");
    }

    /* Forward this to a helper function. */
    this.decreaseKeyUnchecked(entry, newPriority)
  }

  delete (entry) {
    /* Use decreaseKey to drop the entry's key to -infinity.  This will
    * guarantee that the node is cut and set to the global minimum.
    */
    this.decreaseKeyUnchecked(entry, -Infinity)

    /* Call dequeueMin to remove it. */
    this.dequeueMin()
  }

  decreaseKeyUnchecked (entry, priority) {
    /* First, change the node's priority. */
    entry.mPriority = priority

    /* If the node no longer has a higher priority than its parent, cut it.
    * Note that this also means that if we try to run a delete operation
    * that decreases the key to -infinity, it's guaranteed to cut the node
    * from its parent.
    */
    if (entry.mParent !== null && entry.mPriority <= entry.mParent.mPriority) {
      this.cutNode(entry)
    }

    /* If our new value is the new min, mark it as such.  Note that if we
    * ended up decreasing the key in a way that ties the current minimum
    * priority, this will change the min accordingly.
    */
    if (entry.mPriority <= this.mMin.mPriority) {
      this.mMin = entry
    }
  }

  cutNode (entry) {
    /* Begin by clearing the node's mark, since we just cut it. */
    entry.mIsMarked = false

    /* Base case: If the node has no parent, we're done. */
    if (entry.mParent == null) return

    /* Rewire the node's siblings around it, if it has any siblings. */
    if (entry.mNext !== entry) { // Has siblings
      entry.mNext.mPrev = entry.mPrev
      entry.mPrev.mNext = entry.mNext
    }

    /* If the node is the one identified by its parent as its child,
    * we need to rewrite that pointer to point to some arbitrary other
    * child.
    */
    if (entry.mParent.mChild === entry) {
      /* If there are any other children, pick one of them arbitrarily. */
      if (entry.mNext !== entry) {
        entry.mParent.mChild = entry.mNext
      } else {
        /* Otherwise, there aren't any children left and we should clear the
        * pointer and drop the node's degree.
        */
        entry.mParent.mChild = null
      }
    }

    /* Decrease the degree of the parent, since it just lost a child. */
    entry.mParent.mDegree -= 1

    /* Splice this tree into the root list by converting it to a singleton
    * and invoking the merge subroutine.
    */
    entry.mPrev = entry.mNext = entry
    this.mMin = FibonacciHeap.mergeLists(this.mMin, entry)

    /* Mark the parent and recursively cut it if it's already been
    * marked.
    */
    if (entry.mParent.mIsMarked) {
      this.cutNode(entry.mParent)
    } else {
      entry.mParent.mIsMarked = true
    }

    /* Clear the relocated node's parent; it's now a root. */
    entry.mParent = null
  }
}

export default FibonacciHeap
