const { watch, computed } = require('../vuefy.js')
Page({
  data: {
    test: { a: 123 },
    test1: 'test1',
  },
  onLoad() {
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
  },
  changeTest() {
    this.setData({ test: { a: Math.random().toFixed(5) } })
  },
})
