1. 先比较老两个元素是否是能复用的 div -> span  删除div 直接换成span
2. 如果两个元素 类型都是div key都是undefined 说明两个元素可以复用。 需要比对两个元素的属性
3. 比较两个节点的儿子元素