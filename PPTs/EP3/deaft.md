# 对于EP3的草稿

> 学校给出的讲座主题是“AI赋能新时代软件工程--主流智能开发工具实战与趋势”。前半句是废话，我们围绕“实战”与“趋势”做文章。

最终通过一份PPTx+多份html小动画+几个简单的演示实例构成整次分享。


## 留给导师的前15分钟

> 需要导师来做开场白。导师会讲的主题是学“生普遍用AI帮助编程的现象，以及这个现象带来的弊端。要求两页PPT，导师会自行发挥讲10～15分钟。

一个信息需要让大家了解的是，我问过在字节工作的学长。所有人都是Agent重度使用者。
他们少数组要求review所有Agent生成的代码；多数组接受完全由Agent接管。
找到差异化的点很重要。


## 智能开发工具实战

这里只讲Codex和Pi。
**值得注意的是，现场来的同学应该都会搞一个Coding Agent（ClaudeCode/Codex/Cursor），在合适的工作目录启动Coding Agent，然后提出需求，让Agent去改。**

### 前置内容
- LLM API里装了什么，返回什么（不要讲细节schema，讲上下文的组成变化）
- ReAct Loop（最好有一个html动画，画出LLM每次推理启动，上下文的状态。包括system_prompt, thinking，tool，final，observation）

*系统提示词如何拼装放在Pi的“上下文管理”里细讲*


### Codex

Codex有什么值得演示的，别的Agent Harness没有的功能吗？
我能想到的：
- 最强的computer use
- 在web上annotation来改前端。

### Pi

并非开箱即用，需要自己适配运行时需求。
这其实是Coding背景者和业余人员差异化的点之一。

- 安装和登陆。
- 安装后，只给一个超小任务，看看Pi工作究竟有多简便。
- 只问pi有什么工具。
- 切换主题颜色（适配ghostty透明终端）。
- 安装几个插件，看看效果。
候选插件：我做的worktree-hud、pi-breath；pi-web-access；pi-task-list；pi-plan-mode。
- 安装完后，问问还有什么工具，看看运行时效果。

- 上下文管理 https://scpz24.cn/posts/pi， 这里其实详细讲了系统提示词是如何拼装的。也需要一个html动画来讲清楚。


## 智能开发工具趋势

通过Loop的形式去讲。

一个问题，从确定问题到解决问题的过程，我们称为e2e(end to end)。

人和AI交互直到e2e验收完成，这个过程中，需要多轮交互。我们称之为Loop（注意，区别于ReAct loop）

我们也用一个html小动画来演示。
动画中要分屏，左侧是Agent职责侧，右侧是人类职责侧。
讲清楚一次e2e中，人类在干什么，AI在干什么。
动画的每一个阶段就是一个时代：ChatBox时代，Prompt Engineering时代，Context Engineering时代，Harness Engineering时代，等等。


## AI/CS学习路线

### 编程语言在AI时代的生态位

- Python：适合做实验/数学建模/脚本，用处最多，求职最广。建议会。
- TypeScript：适合做Agent产品与前端。
- C++：完成复杂、性能敏感的系统。可以配合CUDA写驱动GPU的LLM推理引擎。
- Rust：强调内存安全与性能控制。用于写高性能Agent Harness或者轻量工具。


### 计算机基础

可以不做笔记，但是一定要做Lab！

#### 入门
- CS61A：Python为主，通过函数、递归、数据抽象、面向对象等内容，训练如何组织程序、控制复杂度。最后Lab手写一个解释器。


#### 有意思的编程课
- CS61B：Java为主。包含两大块：Java与面向对象编程；数据结构。学完等于掌握本校大一下的面向对象程序设计和大二上的数据结构。最后要求学生自己动脑经实现一个“地图生成游戏”（课程给脚手架，学生往里面填充具体的算法）。
- MIT6.102：我正在学。TypeScript为主，讲解学校里不会教的软件工程的细节和习惯。


#### 数学强化
- MIT18.06：线性代数常青树。
- MIT6.041：足够硬核的概率论。

当代LLM推理架构一般是transformers。transformers里其实能找到大学数学的影子：
- 前向传播：线性代数/矩阵乘法
- 反向传播：偏导数、链式法则/高等数学；梯度、矩阵偏导：高数和线代大舞台。
- SoftMax/token采样：概率论


#### 机器学习

- MIT6.036：Python+numpy。比较难的“机器学习基础课”。适合数学好的同学，有挑战性。
- 吴恩达机器学习系列：Python+Pytorch。门槛低，更像科普。
- MIT6.S184：Python+Pytorch。AI图像生成精品小课。讲清楚用于图像生成的Flow/Diffusion模型原理，扩展到U-net/ViT。


#### 大语言模型数学原理与工程实践
- CS224N：Python+Pytorch进入自然语言处理的世界，讲清楚人类处理自然语言的各种工具和尝试，包括N-Gram，RNN，LSTM，Transformers等。Lab里有一个机器学习翻译器。
- CUDA Programming Course – High-Performance Computing with GPUs：从0学习CUDA语言。最后用CUDA实现一个多层感知器，用于手写数字识别。
- CMU11868：用C++和Python手写一个“小Pytorch”。现代LLM原理。3侧入手：
    1. 数学上讲清Transformers
    2. 把数学变成工程化引擎：数学的矩阵乘法在GPU的硬件上如何加速；CUDA语言/GEMM是什么？显存/计算谁是瓶颈？
    3. 推理加速：多卡协作（显存/计算/通信/流水线调度）；量化
