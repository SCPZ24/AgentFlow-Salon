# TS速成PPT脚本
> 目标受众：有Python基础的开发者，零TS经验
> 风格建议：`tokyo-night` 或 `dracula`（技术分享首选）
> 全deck模板：`tech-sharing`
> 预计页数：14页，约25分钟
> 分隔符 `---` 代表翻页

---

## 封面

**标题：** Python转TypeScript：迁移学习30分钟速通

**副标题：** 其实法非常像

**Speaker tag：** AgentFlow Salon · EP2

---

## 为什么你需要TS

**大标题：** AI时代，为什么Python开发者必须懂TS？

**三栏卡片：**
- 💻 **主流前端框架全是TS**
  vue / react
- ⚡ **边缘运行时只认JS/TS**
  Cloudflare Workers / Deno / Bun
- 🔒 **类型安全 = 更少Bug**
  AI生成代码的最佳拍档
- 🤖 **完全适配AI/Agent**

---

## 两个语言的世界观对比

**大标题：** 先建立心智模型

**左右对比表：**

| 维度 | Python | TypeScript |
|---|---|---|
| 类型 | 动态（运行时检查） | 静态（编译期检查） |
| 执行 | 直接运行 `.py` | 先编译→再运行 `.js` |
| 面向对象 | 可选 | 深度集成 |
| 缩进 | 强制（语法） | 可选（风格） |
| Null | `None` | `null` / `undefined` 两种！ |
| 包管理 | `pip` | `npm` / `pnpm` |

**底部警示：** ⚠️ 最大坑：TS有`null`和`undefined`两个"空"

---

## 变量声明

**大标题：** 变量：像C++一样申明类型

**左列（Python）：**
```python 
# Python - 直接赋值，类型随时变
name = "Alice"
age = 30
age = "thirty"  # 完全合法！
```

**右列（TypeScript）：**
```typescript
// TypeScript - 三种声明方式
const name = "Alice"    // 不可重赋值（推荐）
let age = 30            // 可重赋值
age = "thirty"          // ❌ 编译报错！

// 显式注解类型
let score: number = 100
let tag: string = "ok"
```

**底部规则框：**
> 规则：优先用 `const`，需要改才用 `let`，永远不要用 `var`

---

## 函数定义

**大标题：** 函数：`def` → `function` / 箭头函数

**Python：**
```python
# 普通函数
def add(a: int, b: int) -> int:
    return a + b

# Lambda
double = lambda x: x * 2
```

**TypeScript（三种写法都要认识）：**
```typescript
// function 关键字（像 def）
function add(a: number, b: number): number {
    return a + b
}

// 箭头函数（最常见，AI最常生成）
const add = (a: number, b: number): number => a + b

// 可选参数和默认值
function greet(name: string, greeting = "Hello"): string {
    return `${greeting}, ${name}!`  // 模板字符串用反引号
}
```

**高亮提示：** Python的f-string `f"Hi {name}"` = TS的模板字符串 `` `Hi ${name}` ``

---

## 类型系统

**大标题：** 类型：从"注释"到"一等公民"

**左列 - Python类型提示（可选装饰）：**
```python
# Python hints 只是提示，运行时不管
def process(data: list[str]) -> dict:
    pass

from typing import Optional
def find(id: int) -> Optional[str]:
    return None
```

**右列 - TypeScript类型（强制契约）：**
```typescript
// 基础类型
let x: number
let s: string
let b: boolean
let nothing: null | undefined

// 联合类型（Python没有原生对应）
type Status = "ok" | "error" | "loading"
let state: Status = "ok"

// 对象类型
type User = {
    id: number
    name: string
    email?: string   // ? = 可选字段
}
```

**右侧标注：** `?` 等价于 Python 的 `Optional[T]`

[NOTES]
这里是最核心的一页。Python的类型提示是"君子协定"，TS的类型是"法律合同"。
联合类型是TS最有用的特性之一，Python 3.10之前都没有原生支持。

---

## 接口与泛型

**大标题：** Interface & Generic：Python里你其实也在用

**Python对比：**
```python
# Python用dataclass/TypedDict代替
from dataclasses import dataclass
@dataclass
class Response:
    data: list
    error: str | None

# 泛型用TypeVar
from typing import TypeVar, Generic
T = TypeVar('T')
```

**TypeScript：**
```typescript
// Interface：定义对象结构契约
interface ApiResponse<T> {
    data: T
    error: string | null
    status: number
}

// 使用泛型
const res: ApiResponse<User[]> = await fetchUsers()
res.data  // 类型是 User[]，IDE自动补全！

// type vs interface：简单用type，需要extends用interface
type Point = { x: number; y: number }
```

**底部对照：** Python `TypedDict` ≈ TS `interface` ≈ TS `type`

---

## 类与模块

**大标题：** Class & Import：最像Python的部分

**左列（Python）：**
```python
class Animal:
    def __init__(self, name: str):
        self.name = name

    def speak(self) -> str:
        return f"{self.name} speaks"

class Dog(Animal):
    def speak(self) -> str:
        return f"{self.name} barks"

# 导入
from animal import Dog
```

**右列（TypeScript）：**
```typescript
class Animal {
    constructor(public name: string) {}
    //          ^ public 直接声明成属性

    speak(): string {
        return `${this.name} speaks`
    }
}

class Dog extends Animal {
    speak(): string {
        return `${this.name} barks`
    }
}

// 导入（ES Module风格）
import { Dog } from './animal'
import type { Animal } from './animal'  // 仅导入类型
```

---

## 异步编程

**大标题：** Async/Await：概念完全一样，语法99%相同

**Python：**
```python
import asyncio

async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as s:
        async with s.get(url) as r:
            return await r.json()

# 运行
asyncio.run(fetch_data("https://api.example.com"))
```

**TypeScript：**
```typescript
async function fetchData(url: string): Promise<object> {
    const res = await fetch(url)        // 浏览器/Node原生支持
    const data = await res.json()
    return data
}

// 错误处理
try {
    const data = await fetchData("https://api.example.com")
} catch (err) {
    console.error(err)     // print() → console.log()
}
```

**高亮对照：**
- Python `asyncio.run()` ≈ TS 顶层 `await`（Node 16+ / 浏览器）
- Python `Coroutine` = TS `Promise<T>`

---

## 最容易踩的坑

**大标题：** ⚠️ 五个必须知道的差异

**列表（带emoji）：**

1. **`undefined` ≠ `null` ≠ `None`**
   TS有两种空：`null`是主动赋的空，`undefined`是"从来没被赋值"
   ```typescript
   let a: string | null = null      // 主动置空
   let b: string | undefined        // 未初始化
   ```

2. **`this` 会丢失上下文**
   ```typescript
   class Timer {
       count = 0
       start() {
           setInterval(() => this.count++, 1000)  // 箭头函数保留this
           // setInterval(function() { this.count++ }, 1000)  ❌ this是undefined
       }
   }
   ```

3. **数组越界不报错**
   ```typescript
   const arr = [1, 2, 3]
   arr[10]  // undefined，不是IndexError！
   ```

4. **`==` vs `===`**
   永远用 `===`（严格相等），`==` 会做类型转换（Python没有这个问题）

5. **`typeof null === "object"`**
   JS历史遗留Bug，检查null用 `=== null` 而不是typeof

---

## 工具链速览

**大标题：** 环境搭建：5分钟起飞

**步骤流程（横向）：**

```bash
# 1. 安装Node.js（相当于Python解释器）
# https://nodejs.org

# 2. 全局安装TypeScript编译器
npm install -g typescript ts-node

# 3. 初始化项目
mkdir my-ts-project && cd my-ts-project
npm init -y
npx tsc --init   # 生成 tsconfig.json

# 4. 写代码
echo 'const msg: string = "Hello TS!"
console.log(msg)' > index.ts

# 5. 运行（两种方式）
ts-node index.ts        # 直接运行（开发用，相当于python xxx.py）
tsc && node index.js    # 先编译再运行（生产用）
```

**右侧工具对照表：**
| Python | TypeScript |
|---|---|
| `python` | `node` |
| `pip` | `npm` / `pnpm` |
| `venv` | `node_modules` |
| `mypy` | `tsc`（内置！）|
| `black` | `prettier` |
| `pylint` | `eslint` |

---

## 速查对照表

**大标题：** Python → TypeScript 即时翻译

**核心语法对照（双列代码块）：**

| Python | TypeScript |
|---|---|
| `print("hi")` | `console.log("hi")` |
| `len(arr)` | `arr.length` |
| `arr.append(x)` | `arr.push(x)` |
| `dict.keys()` | `Object.keys(obj)` |
| `f"{x}"` | `` `${x}` `` |
| `range(5)` | `Array.from({length:5},(_,i)=>i)` |
| `[x*2 for x in arr]` | `arr.map(x => x * 2)` |
| `[x for x in arr if x>0]` | `arr.filter(x => x > 0)` |
| `isinstance(x, str)` | `typeof x === "string"` |
| `try/except` | `try/catch` |
| `None` | `null` 或 `undefined` |
| `True/False` | `true/false` |
| `and/or/not` | `&&/\|\|/!` |

---

## 总结与资源

**大标题：** 你已经掌握80%了

**左侧 - 今天学了什么：**
- ✅ 类型系统：从注释到契约
- ✅ 变量声明：const / let
- ✅ 函数：三种写法
- ✅ Interface & 泛型
- ✅ Class & 模块
- ✅ Async/Await：和Python一模一样
- ✅ 五大陷阱：null/this/越界/===/typeof

**右侧 - 推荐资源：**
- 📖 **官方文档**：[typescriptlang.org/docs](https://www.typescriptlang.org/docs)
  → "TypeScript for Python Programmers" 专题页
- 🎮 **在线练习**：[TypeScript Playground](https://www.typescriptlang.org/play)
  → 相当于Python REPL，无需安装
- 📦 **第一个真实项目**：用TS写一个调用OpenAI API的脚本
  → `npm install openai` → 类型提示超强！
- 🔗 **下一步**：LangChain.js / Vercel AI SDK

**底部金句：** "TypeScript是Python的镜像，核心思想完全相通，你只是在学新语法，不是新思维。"
