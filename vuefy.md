### 在微信小程序里使用 watch 和 computed

在开发 vue 的时候，我们可以使用 watch 和 computed 很方便的检测数据的变化，从而做出相应的改变，但是在小程序里，只能在数据改变时手动触发 `this.setData()`，那么如何给小程序也加上这两个功能呢？

我们知道在 vue 里是通过 `Object.defineProperty` 来实现数据变化检测的，给该变量的 setter 里注入所有的绑定操作，就可以在该变量变化时带动其它数据的变化。那么是不是可以把这种方法运用在小程序上呢？

实际上，在小程序里实现要比 vue 里简单，应为对于 data 里对象来说，vue 要递归的绑定对象里的每一个变量，使之响应式化。但是在微信小程序里，不管是对于对象还是基本类型，只能通过 `this.setData()` 来改变，这样我们只需检测 data 里面的 **key** 值的变化，而不用检测 **key** 值里面的 **key** 。

先上测试代码

```html
<view>{{ test.a }}</view>
<view>{{ test1 }}</view>
<view>{{ test2 }}</view>
<view>{{ test3 }}</view>
<button bindtap="changeTest">change</button>
```

```js
const { watch, computed } = require('./vuefy.js')
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
```

现在我们要实现 watch 和 computed 方法，使得 test 变化时，test1、test2、test3 也变化，为此，我们增加了一个按钮，当点击这个按钮时，test 会改变。

watch 方法相对简单点，首先我们定义一个函数来检测变化：

```js
function defineReactive(data, key, val, fn) {
  Object.defineProperty(data, key, {
    configurable: true,
    enumerable: true,
    get: function() {
      return val
    },
    set: function(newVal) {
      if (newVal === val) return
      fn && fn(newVal)
      val = newVal
    },
  })
}
```

然后遍历 watch 函数传入的对象，给每个键调用该方法

```js
function watch(ctx, obj) {
  Object.keys(obj).forEach(key => {
    defineReactive(ctx.data, key, ctx.data[key], function(value) {
      obj[key].call(ctx, value)
    })
  })
}
```

这里有参数是 fn ，即上面 watch 方法里 test 的值，这里把该方法包一层，绑定 context。

接着来看 computed，这个稍微复杂，因为我们无法得知 computed 里依赖的是 data 里面的哪个变量，因此只能遍历 data 里的每一个变量。

```js
function computed(ctx, obj) {
  let keys = Object.keys(obj)
  let dataKeys = Object.keys(ctx.data)
  dataKeys.forEach(dataKey => {
    defineReactive(ctx.data, dataKey, ctx.data[dataKey])
  })
  let firstComputedObj = keys.reduce((prev, next) => {
    ctx.data.$target = function() {
      ctx.setData({ [next]: obj[next].call(ctx) })
    }
    prev[next] = obj[next].call(ctx)
    ctx.data.$target = null
    return prev
  }, {})
  ctx.setData(firstComputedObj)
}
```

详细解释下这段代码，首先给 data 里的每个属性调用 `defineReactive` 方法。接着计算 computed 里面每个属性第一次的值，也就是上例中的 test2、test3。 

```js
computed(this, {
  test2: function() {
    return this.data.test.a + '2222222'
  },
  test3: function() {
    return this.data.test.a + '3333333'
  }
})
```

这里分别调用 test2 和 test3 的值，将返回值与对应的 key 值组合成一个对象，然后再调用 `setData()` ，这样就会第一次计算这两个值，这里使用了 `reduce` 方法。但是你可能会发现其中这两行代码，它们好像都没有被提到是干嘛用的。

```js
  ctx.data.$target = function() {
    ctx.setData({ [next]: obj[next].call(ctx) })
  }
  
  ctx.data.$target = null
```

可以看到，test2 和 test3 都是依赖 test 的，这样必须在 test 改变的时候在其的 setter 函数中调用 test2 和 test3 中对应的函数，并通过 setData 来设置这两个变量。为此，需要将 `defineReactive` 改动一下。

```js
function defineReactive(data, key, val, fn) {
  let subs = [] // 新增
  Object.defineProperty(data, key, {
    configurable: true,
    enumerable: true,
    get: function() {
      // 新增
      if (data.$target) {
        subs.push(data.$target)
      }
      return val
    },
    set: function(newVal) {
      if (newVal === val) return
      fn && fn(newVal)
      // 新增
      if (subs.length) {
        // 用 setTimeout 因为此时 this.data 还没更新
        setTimeout(() => {
          subs.forEach(sub => sub())
        }, 0)
      }
      val = newVal
    },
  })
}
```

相较于之前，增加了几行代码，我们声明了一个变量来保存所有在变化时需要执行的函数，在 set 时执行每一个函数，因为此时 `this.data.test` 的值还未改变，使用 setTimeout 在下一轮再执行。现在就有一个问题，怎么将函数添加到 subs 中。不知道各位还是否记得上面我们说到的在 reduce 里的那两行代码。因为在执行计算 test1 和 test2 第一次 computed 值的时候，会调用 test 的 getter 方法，此刻就是一个好机会将函数注入到 subs 中，在 data 上声明一个 $target 变量，并将需要执行的函数赋值给该变量，这样在 getter 中就可以判断 data 上有无 target 值，从而就可以 push 进 subs，要注意的是需要马上将 target 设为 null，这就是第二句的用途，这样就达到了一石二鸟的作用。当然，这其实就是 vue 里的原理，只不过这里没那么复杂。

到此为止已经实现了 watch 和 computed，但是还没完，有个问题。当同时使用这两者的时候，watch 里的对象的键也同时存在于 data 中，这样就会重复在该变量上调用 `Object.defineProperty` ，后面会覆盖前面。因为这里不像 vue 里可以决定两者的调用顺序，因此我们推荐先写 computed 再写 watch，这样可以 watch computed 里的值。这样就有一个问题，computed 会因覆盖而无效。

思考一下为什么？

很明显，这时因为之前的 subs 被重新声明为空数组了。这时，我们想一个简单的方法就是把之前 computed 里的 subs 存在一个地方，下一次调用 `defineReactive` 的时候看对应的 key 是否已经有了 subs，这样就可以解决问题。修改一下代码。

```js
function defineReactive(data, key, val, fn) {
  let subs = data['$' + key] || [] // 新增
  Object.defineProperty(data, key, {
    configurable: true,
    enumerable: true,
    get: function() {
      if (data.$target) {
        subs.push(data.$target)
        data['$' + key] = subs // 新增
      }
      return val
    },
    set: function(newVal) {
      if (newVal === val) return
      fn && fn(newVal)
      if (subs.length) {
        // 用 setTimeout 因为此时 this.data 还没更新
        setTimeout(() => {
          subs.forEach(sub => sub())
        }, 0)
      }
      val = newVal
    },
  })
}
```

这样，我们就一步一步的实现了所需的功能。完整的代码和例子请戳。

虽然经过了一些测试，但不保证没有其它未知错误，欢迎提出问题。