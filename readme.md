在微信小程序里使用 watch 和 computed

#### 使用方法

```js
const { watch, computed } = require('../vuefy.js')

computed(this, {
  test2: function() {
    return this.data.test.a + '2222222'
  },
  test3: function() {
    return this.data.test.a + '3333333'
  }
})

watch(this, {
  test: function(newVal) {
    console.log('invoke watch')
    this.setData({ test1: newVal.a + '11111111' })
  }
})
```

先引用，然后在 `onLoad` 里使用，如果两者都用，将 computed 写在 watch 前面

更多细节，查看 [介绍](./vuefy.md)