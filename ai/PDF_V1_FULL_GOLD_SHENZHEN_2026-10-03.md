# 深圳卷全文核对金标 — 2026-10-03

源：广东深圳高级中学（集团）2026届高三适应性考试数学试卷 (1).pdf；SHA256 `874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21`，21个原PDF页。原试卷1–7页，第8页空白，答案9–21页。这里按原题号转录，换行/空格和等价LaTeX排版统一；不删除分析/详解/点睛/方法、原源杂字或原答案块中的证明，不重算原解答。图表以原页和标签清单作金标，不能以模型bbox代替完整图。

已逐页目视核对21页，覆盖19题及跨页全文。第5题解析减号和第15题两处分式分子存在源渲染歧义，状态为 source_ambiguous，其余17题按可见源文转录。源文自身的杂字、错字、数学推导问题另记 source_literal；全文金标不能替代机器识别验收。

## 1

题型：单选题。题目页1；答案/解析页9。

### 题目

复数 $z$ 满足 $z(1+i)=2i$，其中 $i$ 为虚数单位，则 $|z|=$（ ）

A. $2$；B. $2\sqrt2$；C. $1$；D. $\sqrt2$。

### 答案

D

### 解析

【分析】根据复数代数形式的除法运算化简 $z$，再计算其模即可。

【详解】因为 $z(1+i)=2i$，所以 $z=\frac{2i}{1+i}=\frac{2i(1-i)}{(1+i)(1-i)}=1+i$，所以 $|z|=\sqrt{1^2+1^2}=\sqrt2$。

故选：D。

### 图表

无图。

## 2

题型：单选题。题目页1；答案/解析页9。

### 题目

“$\varphi=-\frac\pi4+k\pi\ (k\in\mathbb Z)$”是“函数 $y=\tan(x+\varphi)$ 的图象关于 $\left(\frac\pi4,0\right)$ 对称”的（ ）

A. 充分不必要条件；B. 必要不充分条件；C. 充要条件；D. 既不充分也不必要条件。

### 答案

A

### 解析

【分析】若函数 $y=\tan(x+\varphi)$ 的图象关于 $\left(\frac\pi4,0\right)$ 对称，根据正切函数的对称性可得 $\varphi=-\frac\pi4+\frac{k\pi}2\ (k\in\mathbb Z)$，再根据充分、必要条件结合包含关系分析求解。

【详解】若函数 $y=\tan(x+\varphi)$ 的图象关于 $\left(\frac\pi4,0\right)$ 对称，则 $\frac\pi4+\varphi=\frac{k\pi}2\ (k\in\mathbb Z)$，解得 $\varphi=-\frac\pi4+\frac{k\pi}2\ (k\in\mathbb Z)$。

因为 $\{\varphi\mid\varphi=-\frac\pi4+k\pi,k\in\mathbb Z\}$ 是 $\{\varphi\mid\varphi=-\frac\pi4+\frac{k\pi}2,k\in\mathbb Z\}$ 的真子集，所以“$\varphi=-\frac\pi4+k\pi\ (k\in\mathbb Z)$”是“函数 $y=\tan(x+\varphi)$ 的图象关于 $\left(\frac\pi4,0\right)$ 对称”的充分不必要条件。

故选：A。

### 图表

无图。

## 3

题型：单选题。题目页1；解析页9–10（页10开头排除 $a=-1$）。

### 题目

设集合 $A=\{-2,1,a\}$，$B=\{-1,a^2\}$，若 $A\cup B$ 含有4个元素，则 $a=$（ ）

A. $-1$；B. $0$；C. $1$；D. $2$。

### 答案

B

### 解析

【分析】根据集合元素的互异性及并集的概念求解即可。

【详解】根据集合元素的互异性可知，$a\ne1$，$a\ne-2$。因为 $A\cup B$ 含有4个元素，所以 $A\cap B$ 仅含有1个元素。

若 $a^2\in A$，则 $a^2=1$ 或 $a^2=a$，所以 $a=0$ 或 $a=\pm1$。若 $-1\in A$，则 $a=-1$。结合集合元素的互异性可知 $a=0$ 或 $a=-1$。

当 $a=0$ 时，$A=\{-2,1,0\}$，$B=\{-1,0\}$，$A\cup B=\{-2,-1,0,1\}$，符合题意。

当 $a=-1$ 时，$A=\{-2,1,-1\}$，$B=\{-1,1\}$，$A\cup B=\{-2,-1,1\}$，不符合题意。

综上，$a=0$。

### 图表

无图。

## 4

题型：单选题。题目页1；解析页10。

### 题目

已知函数 $f(x)=e^x+ae^{-x}\ (a\in\mathbb R)$ 的图象关于原点对称，则 $f(a)=$（ ）

A. $\frac1e-e$；B. $1$；C. $e-\frac1e$；D. $e+\frac1e$。

### 答案

A

### 解析

【分析】因为函数 $f(x)=e^x+ae^{-x}\ (a\in\mathbb R)$ 的图象关于原点对称，可得函数 $f(x)$ 为定义域为 $\mathbb R$ 奇函数，根据奇函数性质 $f(-x)=-f(x)$，可得 $f(0)=0$，求得 $a$ 值，进而求得 $f(a)$。

【详解】∵函数 $f(x)=e^x+ae^{-x}\ (a\in\mathbb R)$ 的图象关于原点对称，可得：$f(x)$ 为定义域为 $\mathbb R$ 奇函数。根据奇函数性质 $f(-x)=-f(x)$，令 $x=0$，可得 $f(0)=0$。又∵ $f(0)=e^0+ae^0=0$，∴ $a=-1$，∴ $f(x)=e^x-e^{-x}$。故 $f(a)=f(-1)=e^{-1}-e^1=\frac1e-e$。

故选：A。

【点睛】本题解题关键是掌握奇函数在定义域包含 $x=0$ 时，$f(0)=0$，考查了分析能力和计算能力，属于基础题。

### 图表

无图。

## 5

题型：单选题。题目页1；解析页10。解析末行状态：**source_ambiguous**。

### 题目

如图，平行四边形 $OABC$ 中，$OA=5,OC=4$，作如下图所示网格，使得每个小平行四边形都是菱形，若 $\overrightarrow{OA}\cdot\overrightarrow{OC}=-10$，则 $\overrightarrow{CD}\cdot\overrightarrow{PQ}=$（ ）

A. $\frac{15}2$；B. $-\frac92$；C. $-\frac72$；D. $\frac72$。

### 答案

C（原页9答案表及页10题头）。

### 解析

【分析】选用 $\vec a,\vec b$ 为基底向量，即可根据向量的线性运算以及数量积的运算律求解。

【详解】设与 $\overrightarrow{OA},\overrightarrow{OC}$ 方向相同的单位向量分别为 $\vec a,\vec b$，则 $\overrightarrow{OA}\cdot\overrightarrow{OC}=5\vec a\cdot4\vec b=-10$，故 $\vec a\cdot\vec b=-\frac12$。

由于 $\overrightarrow{CD}=\vec a-2\vec b,\overrightarrow{PQ}=2\vec a+3\vec b$，故

$$\overrightarrow{CD}\cdot\overrightarrow{PQ}=(\vec a-2\vec b)\cdot(2\vec a+3\vec b)=2\vec a^2-\vec a\cdot\vec b-6\vec b^2=2\,\text{源字形A}\left(-\frac12\right)-6=\text{源字形B}\frac72.$$

源证据注记：文本层记录两处为减号，得到 `2-(-1/2)-6=-7/2`；PDF.js原可见图缺这些符号，不能直接把文本层作为已确认视觉金标。上述占位只标记歧义位置，不是允许模型输出占位。原答案C单独可核；全文质量中这两处不得按已正确/已错误强计。

### 图表

题目页1：完整平行四边形及菱形网格，标签O/A/B/C/D/P/Q，保留 $\overrightarrow{CD}$ 和 $\overrightarrow{PQ}$ 两箭头、边与虚线网格，不裁掉右侧A和左侧C。

## 6

题型：单选题。题目页1；解析页10–11。

### 题目

抛物线有如下光学性质：平行于抛物线对称轴的光线，经过抛物线上的点反射后，反射光线经过抛物线的焦点。过点 $P(2\sqrt2,5)$ 且平行于 $y$ 轴的一条光线射向抛物线 $C:x^2=4y$ 上的 $A$ 点，经过反射后的反射光线与 $C$ 相交于点 $B$，则 $|AB|=$（ ）

A. $\frac72$；B. $9$；C. $36$；D. $\frac92$。

### 答案

D

### 解析

【分析】首先求出直线 $AB$ 的方程为 $y=\frac{\sqrt2}4x+1$，将其与抛物线方程联立，得到韦达定理式，则得到 $y_A+y_B=\frac52$，最后利用焦点弦公式即可。

【详解】令 $x=2\sqrt2$，则 $y=\frac{(2\sqrt2)^2}4=2$，则点 $A$ 的坐标为 $(2\sqrt2,2)$，$C$ 的焦点为 $F(0,1)$，则 $k_{AF}=\frac{2-1}{2\sqrt2}=\frac{\sqrt2}4$，所以直线 $AB$ 的方程为 $y=\frac{\sqrt2}4x+1$。

与抛物线方程 $x^2=4y$ 联立，消去 $y$ 得 $x^2-\sqrt2x-4=0$，由韦达定理得 $x_A+x_B=\sqrt2$，所以 $y_A+y_B=\frac{\sqrt2}4(x_A+x_B)+2=\frac52$，所以由抛物线的定义得 $|AB|=y_A+y_B+2=\frac92$。

故选：D。

### 图表

解析页11的抛物线图，x/y轴箭头、O/F/A/B/P及光线路径，属于6题，不能附给紧随的7题。

## 7

题型：单选题。题目页1；解析页11。

### 题目

函数 $f(x)=2+\ln x$ 与函数 $g(x)=e^x$ 公切线的斜率为（ ）

A. $e^2$；B. $e$；C. $1$或$e$；D. $1$或$e^2$。

### 答案

C

### 解析

【分析】利用导数来求切线方程，再通过公切线得到方程组求解即可。

【详解】由题意可得 $f'(x)=\frac1x,g'(x)=e^x$，设切点坐标分别为 $(x_1,2+\ln x_1),(x_2,e^{x_2})$，则函数 $f(x)=2+\ln x$ 在点 $x_1$ 处切线方程为：$y-(2+\ln x_1)=\frac1{x_1}(x-x_1)$，即 $y=\frac1{x_1}x+1+\ln x_1$。

函数 $g(x)=e^x$ 在点 $x_2$ 处切线方程为：$y-e^{x_2}=e^{x_2}(x-x_2)$，即 $y=e^{x_2}x+(1-x_2)e^{x_2}$。

根据两切线是公切线可得：$\begin{cases}e^{x_2}=\frac1{x_1},\\(1-x_2)e^{x_2}=1+\ln x_1.\end{cases}$

由 $e^{x_2}=\frac1{x_1}$ 可得 $x_2=-\ln x_1$，所以 $(1+\ln x_1)\frac1{x_1}=1+\ln x_1$，整理得 $(1+\ln x_1)(1-\frac1{x_1})=0$，解得 $x_1=1$ 或 $x_1=\frac1e$，所以公切线斜率为 $k=1$ 或 $k=e$。

### 图表

无图；页11上方的光学图属于6。

## 8

题型：单选题。题目页2；解析页11–12。

### 题目

在平面直角坐标系 $xOy$ 内，若直线 $l:x+y+m=0$ 绕原点 $O$ 逆时针旋转 $90^\circ$ 后与圆 $C:(x-1)^2+(y-2)^2=1$ 有公共点，则实数 $m$ 的取值范围是（ ）

A. $[-\sqrt3-1,\sqrt3-1]$；B. $[-1,\sqrt2+1]$；C. $[-1,\sqrt3+1]$；D. $[-\sqrt2-1,\sqrt2-1]$。

### 答案

D

### 解析

【分析】首先求旋转后的直线，再根据直线与圆的位置关系，即可求解。

【详解】直线 $l:x+y+m=0$ 的斜率为 $-1$，过点 $(-m,0)$，绕原点 $O$ 逆时针旋转 $90^\circ$ 后，斜率为1，过点 $(0,-m)$，得到直线 $x-y-m=0$。

若该直线与圆 $C$ 存在公共点，则圆心 $C(1,2)$ 到直线 $x-y-m=0$ 的距离 $d=\frac{|1-2-m|}{\sqrt2}\le1$，解得 $-\sqrt2-1\le m\le\sqrt2-1$。

故选：D。

### 图表

无图。

## 9

题型：多选题。题目页2；解析页12。

### 题目

从某校高一和高二年级分别随机抽取100名学生进行知识竞赛，按得分（满分100分）绘制如图所示的频率分布直方图，根据频率分布直方图，并用频率估计概率记高一年级学生得分平均数的估计值为 $x$，高二年级学生得分中位数与平均数的估计值分别为 $y,z$。从高一年级各随机抽取一名学生，记事件 $M=$“高一年级学生得分不低于60分，高二年级学生得分不低于80分”，事件 $N=$“高一年级学生得分不低于80分，高二年级学生得分不低于60分”则（ ）

A. $x<z$；B. $y>z$；C. 事件 $M,N$ 互斥；D. $P(M)=P(N)$。

源文注记：“从高一年级各随机抽取”按原可见字句保留，不补写“高二”。

### 答案

AB

### 解析

【分析】由频率分布直方图求出对应 $x,y,z$ 的值，即可判断AB选项；由互斥事件的定义求 $M\cap N$ 来判断C选项；求出 $P(M),P(N)$ 来判断D选项。

【详解】

$x=(35\times0.01+45\times0.02+55\times0.03+65\times0.02+75\times0.01+85\times0.005+95\times0.005)\times10=58.5$，

$z=(35\times0.005+45\times0.01+55\times0.015+65\times0.02+75\times0.03+85\times0.015+95\times0.005)\times10=67.5$，

∵ $0.05+0.1+0.15+0.2=0.5$，∴ $y=70$，∴ $x<z$，A选项正确；$y>z$，B选项正确；

∵ $M\cap N=$“高一年级学生得分不低于80分，高二年级学生得分不低于80分”$\ne\varnothing$，C选项错误；

由频率估计概率得：$P(M)=(0.2+0.1+0.05+0.05)\times(0.15+0.05)=0.08$，$P(N)=(0.05+0.05)\times(0.2+0.3+0.15+0.05)=0.07$，D选项错误。

故选：AB。

### 图表

页2两幅频率分布直方图，均属9：横轴分数30/40/50/60/70/80/90/100及箭头，纵轴“频率/组距”、O、0.005/0.010/0.020/0.030（高二另有0.015）。高一各组柱高 .010/.020/.030/.020/.010/.005/.005；高二 .005/.010/.015/.020/.030/.015/.005；分别标“高一年级学生得分”“高二年级学生得分”，完整保留虚线刻度，不只截柱。

## 10

题型：多选题。题目页2–3（B项尾“的直径”在页3）；解析页12–13。

### 题目

如图，在直三棱柱 $ABC-A_1B_1C_1$ 中，$AB=AC=AA_1=2$，$AB\perp AC$，点 $P,Q,M,N$ 分别是 $BB_1,CC_1,AA_1,BC$ 的中点，则（ ）

A. $P,Q,M,N$ 四点共面；B. 线段 $BC_1$ 为直三棱柱 $ABC-A_1B_1C_1$ 外接球的直径；C. 三棱锥 $P-A_1QN$ 的体积为 $\frac23$；D. 直线 $MN$ 与 $AC$ 所成角余弦值为 $\frac{\sqrt3}3$。

### 答案

BCD

### 解析

【分析】由异面直线的判定判断A；补形成正方体判断B；利用等体积法求出体积判断C；求出异面直线夹角判断D。

【详解】对于A，直线 $QN\subset$ 平面 $BCC_1B_1$，点 $P\in$ 平面 $BCC_1B_1$，而 $P\notin$ 直线 $QN$，点 $M\notin$ 平面 $BCC_1B_1$，因此直线 $PM$ 与直线 $QN$ 是异面直线，则 $P,M,Q,N$ 四点不共面，A错误；

对于B，将三棱柱 $ABC-A_1B_1C_1$ 补形为正方体，$AB,AC,AA_1$ 为该正方体共点的三条棱，矩形 $BCC_1B_1$ 为该正方体对角面，则 $BC_1$ 为三棱柱 $ABC-A_1B_1C_1$ 外接球直径，B正确；

对于C，点 $A_1$ 到平面 $BCC_1B_1$ 的距离为 $\sqrt2$，则 $V_{P-A_1QN}=V_{A_1-PQN}=\frac13\times\frac12\times2\sqrt2\times1\times\sqrt2=\frac23$，C正确；

对于D，取 $AB$ 中点 $O$，连接 $OM,ON$，由 $N$ 是 $BC$ 中点，得 $ON\parallel AC$，则 $\angle MNO$ 是异面直线 $MN$ 与 $AC$ 所成角或其补角。

由已知 $AC\perp AB,AC\perp AA_1,AB\cap AA_1=A,AB,AA_1\subset$ 平面 $ABB_1A_1$，所以 $AC\perp$ 平面 $ABB_1A_1$，故 $ON\perp$ 平面 $ABB_1A_1$。又 $OM\subset$ 平面 $ABB_1A_1$，于是 $ON\perp OM$，而 $ON=\frac12AC=1,OM=\sqrt{1^2+1^2}=\sqrt2$，则 $MN=\sqrt{OM^2+ON^2}=\sqrt3$，因此 $\cos\angle MNO=\frac{ON}{MN}=\frac1{\sqrt3}=\frac{\sqrt3}3$，D正确。

### 图表

题目页2和解析页13各一棱柱图；题图标签A/B/C/A1/B1/C1/P/Q/M/N、隐边虚线。解析图另有O及辅助线。必须包含右侧C1/Q，不能沿模型旧框裁掉；解析图不属11题。

## 11

题型：多选题。题目页3；解析页13–14。

### 题目

如图所示为杨辉三角，是二项式系数在三角形中的一种几何排列，第 $n$ 行的第 $r$ 个数可以表示为 $C_n^{r-1}$（$n\ge1$ 时）。我国南宋数学家杨辉1261年所著的《详解九章算法》一书中就已经出现了这个表，这是我国数学史上的一个伟大成就。同学们开展了数学探究，则下列命题正确的有（ ）

A. 第2026行共有2026个数；B. 从第4行起到第19行，每一行的第4个数字之和为 $C_{20}^4-1$；C. 第48行的所有数字之和被7除的余数为1；D. 去除所有为1的项，依次构成数列 $2,3,3,4,6,4,5,10,10,5,\ldots$，则此数列前135项的和为 $2^{18}-52$。

### 答案

BC

### 解析

【分析】对于A选项，找到每行与每行的数之间的关系，对于B选项，运用杨辉三角的性质求解；对于C选项计算出第48行的所有数之和除以7即可；对于D选项，找到此数列的前 $n$ 项和的式子，再代入 $n$ 为135即可。

【详解】对于A，第2026行共有2027个数，故A错误。

对于B，由题意可得 $C_4^3+C_5^3+C_6^3+\cdots+C_{19}^3=(C_4^4+C_4^3)+C_5^3+C_6^3+\cdots+C_{19}^3-1=C_5^4+C_5^3+C_6^3+\cdots+C_{19}^3-1=\cdots=C_{20}^4-1$，B正确。

对于C，第48行的所有数字之和为 $C_{48}^0+C_{48}^1+C_{48}^2+\cdots+C_{48}^{48}=2^{48}=8^{16}=(1+7)^{16}=C_{16}^0 7^0+C_{16}^1 7^1+C_{16}^2 7^2+\cdots+C_{16}^{16}7^{16}=1+7(C_{16}^1 7^0+C_{16}^2 7^1+\cdots+C_{16}^{16}7^{15})$，由于 $C_{16}^1 7^0+C_{16}^2 7^1+\cdots+C_{16}^{16}7^{15}$ 能被7整除，故第48行的所有数字之和被7除的余数为1，C正确。

对于D，第 $n$ 行的和为 $C_n^0+C_n^1+C_n^2+\cdots+C_n^n=(1+1)^n=2^n$，当 $n\ge1$ 时，第 $n$ 行中去除为1的项的和为 $2^n-2$，第0行为1。

故第1行到第 $n$ 行中去除为1的项的和为 $S_n=\frac{2(1-2^n)}{1-2}-2n=2^{n+1}-2-2n$，故前17行中去除为1的项的和为 $2^{18}-36$。

去除所有为1的项后，则从第一行开始，则剩下的每一行的个数为 $0,1,2,3,4,\ldots$，可以看成一个首项为0，公差为1的等差数列，前 $n$ 行共有 $\frac{n(n-1)}2$ 个数。当 $n=17$ 时，$\frac{17\times16}2=136$，因此前17行中，去掉为1的项，共有136项，且第17行中，去掉为1的项后，最后一项为 $C_{17}^{16}$，则此数列前135项的和为 $S_{17}-C_{17}^{16}=2^{18}-53$，则D答案错误。

源文注记：C项证明中“括号内能被7整除”按原文保留，不校正证明措辞。

### 图表

题图页3杨辉三角：行号0–5和n，0行1；1行1/1；2行1/2/1；3行1/3/3/1；4行1/4/6/4/1；5行1/5/10/10/5/1，竖向省略点、横向点线。解析无新增图。

## 12

题型：填空题。题目页3；解析页14。

### 题目

与双曲线 $x^2-\frac{y^2}4=1$ 有共同渐近线，且过点 $M(2,2)$ 的双曲线方程为______。

### 答案

$\frac{x^2}3-\frac{y^2}{12}=1$

### 解析

【分析】设双曲线方程为 $x^2-\frac{y^2}4=k$，利用双曲线过点 $(2,2)$，求出 $k$，即可得出双曲线方程。

【详解】设双曲线方程为 $x^2-\frac{y^2}4=k,k\ne0$，∵双曲线过点 $(2,2)$，∴ $2^2-\frac{2^2}4=k$，∴ $k=3$。故所求双曲线方程为：$x^2-\frac{y^2}4=3$，即 $\frac{x^2}3-\frac{y^2}{12}=1$。

故答案为：$\frac{x^2}3-\frac{y^2}{12}=1$。

### 图表

无图。

## 13

题型：填空题。题目页3；解析页14。

### 题目

已知数列 $\{a_n\}$ 的前 $n$ 项和为 $S_n$，若 $nS_{n+1}-(n+1)S_n=2(n^2+n)$，且 $a_1=2$，则 $S_n=$______。

### 答案

$2n^2$

### 解析

【详解】0 因为 $nS_{n+1}-(n+1)S_n=2(n^2+n)\Rightarrow\frac{S_{n+1}}{n+1}-\frac{S_n}n=2$，所以数列 $\{\frac{S_n}n\}$ 是以 $\frac{S_1}1=\frac{a_1}1=2$ 为首项，2为公差的等差数列，所以 $\frac{S_n}n=2+2(n-1)=2n\Rightarrow S_n=2n^2$。

源文注记：详解后的孤立0确实存在，不能记成模型虚构；保留在金标，若教师删它另记源文修订。

### 图表

无图。

## 14

题型：填空题。题目页3；解析页14–15。

### 题目

在三角形 $ABC$ 中，$\angle BAC=\frac{2\pi}3,\overrightarrow{BD}=\overrightarrow{DE}=\overrightarrow{EC}$，设 $\angle BAD=\alpha_1,\angle DAE=\alpha_2,\angle EAC=\alpha_3$，则 $\frac{\sin\alpha_2}{\sin\alpha_1\sin\alpha_3}=$______。

### 答案

$2\sqrt3$

### 解析

【分析】利用三角形面积公式及面积比即可求解。

【详解】记 $S_{\triangle ABC}=3S$，则 $|AB||AD|\sin\alpha_1=|AD||AE|\sin\alpha_2=|AE||AC|\sin\alpha_3=2S$，$|AB||AC|\sin\frac{2\pi}3=6S$。

因为 $\frac{|AD||AE|\sin\alpha_2}{|AB||AD|\sin\alpha_1}\frac{|AB||AC|\sin\frac{2\pi}3}{|AE||AC|\sin\alpha_3}=3$，所以 $\frac{\sin\frac{2\pi}3\sin\alpha_2}{\sin\alpha_1\sin\alpha_3}=3$，所以 $\frac{\sin\alpha_2}{\sin\alpha_1\sin\alpha_3}=2\sqrt3$。

故答案为：$2\sqrt3$。

### 图表

解析页15：三角形ABC，底边上依次B、D、E、C，连AD、AE。该图属于14题，不能归给紧随其后的15题。

## 15

题型：解答题。题目页4；答案/解析页15–16。状态：source_ambiguous（两处分式分子）。

### 题目

某公司要在一条笔直的道路边安装路灯，要求灯柱AB与地面垂直，灯杆BC与灯柱AB所在的平面与道路走向垂直，路灯C采用锥形灯罩，射出的光线与平面ABC的部分截面如图中阴影部分所示。已知 $\angle ABC=\frac23\pi,\angle ACD=\frac\pi3$，路宽 $AD=24$ 米。设 $\angle BAC=\theta(\frac\pi{12}\le\theta\le\frac\pi6)$。

(1)若 $\theta=\frac\pi6$，求灯柱AB的高h；

(2)此公司应该如何设置θ的值才能使制造路灯灯柱AB与灯杆BC所用材料的总长度最小？最小值为多少？

### 答案

(1)$h=8\sqrt3$。

(2)设置 $\theta=\frac\pi{12}$ 时，制造路灯灯柱AB与灯杆BC所用材料的总长度最小，最小值为 $8+8\sqrt3$ 米。

### 解析

【分析】(1)在△ACD与△ABC中，由正弦定理即可求出灯柱的高；(2)根据正弦定理，分别表示出灯柱AB与灯杆BC的长，即可表示出AB+BC，结合正弦和角公式化简，结合角的取值范围即可得解。

【详解】(1)在△ACD中，$\angle CAD=\frac{\text{源分子A}}2-\theta,\angle CDA=\theta+\frac{\text{源分子B}}6$，由正弦定理可得：$\frac{AD}{\sin\angle ACD}=\frac{AC}{\sin\angle CDA}$，得 $AC=\frac{AD\sin\angle CDA}{\sin\angle ACD}=16\sqrt3\sin(\theta+\frac\pi6)$。

在△ABC中，$\angle ACB=\frac\pi3-\theta$，由正弦定理可得：$\frac{AB}{\sin\angle ACB}=\frac{AC}{\sin\angle ABC}$，得 $h=\frac{AC\sin\angle ACB}{\sin\angle ABC}=32\sin(\theta+\frac\pi6)\sin(\frac\pi3-\theta)=32\sin(\theta+\frac\pi6)\cos(\frac\pi6+\theta)=16\sin(2\theta+\frac\pi3)(\frac\pi{12}\le\theta\le\frac\pi6)$。

若 $\theta=\frac\pi6$，则灯柱AB的高 $h=8\sqrt3$；

(2)△ABC中，由正弦定理可得：$\frac{BC}{\sin\angle BAC}=\frac{AC}{\sin\angle ABC}$，得 $BC=\frac{AC\sin\angle BAC}{\sin\angle ABC}=32\sin(\theta+\frac\pi6)\sin\theta$。

∴ $AB+BC=32\sin(\theta+\frac\pi6)\sin(\frac\pi3-\theta)+32\sin(\theta+\frac\pi6)\sin\theta$

$=32(\frac{\sqrt3}2\sin\theta+\frac12\cos\theta)(\frac{\sqrt3}2\cos\theta-\frac12\sin\theta)+32(\frac{\sqrt3}2\sin\theta+\frac12\cos\theta)\sin\theta$

$=32(\frac12\sin\theta\cos\theta+\frac{\sqrt3}4\cos^2\theta-\frac{\sqrt3}4\sin^2\theta+\frac{\sqrt3}2\sin^2\theta+\frac12\sin\theta\cos\theta)=16\sin2\theta+8\sqrt3$。

∵ $\frac\pi{12}\le\theta\le\frac\pi6$，∴ $\frac\pi6\le2\theta\le\frac\pi3$，∴当 $\theta=\frac\pi{12}$ 时，AB+BC取得最小值 $8+8\sqrt3$。故设置 $\theta=\frac\pi{12}$ 时，制造路灯灯柱AB与灯杆BC所用材料的总长度最小，最小值为 $8+8\sqrt3$ 米。

源文注记：页15两分子在原图呈“2/6与上方小点叠字”，文本层对应¨和额外2/6。此处保留占位，不依据几何常识补π。页16展开式系数按原图保留，不替源文改推导。

### 图表

题目页4：路灯AB、BC，路面AD，C发出的两边界射线CA、CD和阴影△ACD；标A、B、C、D。

## 16

题型：解答题。题目页4–5；答案/解析页16–17。

### 题目

下表为某汽车模型公司的产品分类，共有25个汽车模型，其外观和内饰的颜色分布如表所示：

| | 红色外观 | 蓝色外观 |
|---|---:|---:|
| 米色内饰 | 8 | 12 |
| 棕色内饰 | 2 | 3 |

(1)若小明从这些模型中随机拿一个模型，记事件A为小明取到的模型为红色外观，事件B为取到模型有棕色内饰。求P(B|A)；

(2)该公司举行了一个回馈客户抽奖活动，并规定，在一次抽奖中，每人可以一次性抽取两个汽车模型。为了得到奖品类型，现作出如下假设：

假设1：每人抽取的两个模型会出现三种结果：①两个模型的外观和内饰均为同色；②两个模型的外观和内饰均为不同色；③两个模型的外观同色但内饰不同色，或内饰同色但外观不同色。

假设2：该抽奖设置三类奖，奖金金额分别为：一等奖600元，二等奖300元，三等奖150元。

假设3：每种抽取的结果都对应一类奖。出现某种结果的概率越小，奖金金额越高。

请判断以上三种结果分别对应几等奖。设中奖的奖金数是X，写出X的分布列，并求X的数学期望。

### 答案

(1)$\frac15$。

(2)抽取的两个模型的外观和内饰均为不同色是一等奖；外观和内饰均为同色是二等奖；外观同色但内饰不同色，或内饰同色但外观不同色是三等奖，奖金额X的分布列：

| X | 600 | 300 | 150 |
|---|---:|---:|---:|
| P | 4/25 | 49/150 | 77/150 |

$E(X)=271$。

### 解析

【分析】(1)由古典概率计算公式及条件概率公式即可求解；(2)分别求出三种结果对应的概率，比较大小，确定对应的概率，求出分布列，利用期望公式进行计算即可。

【详解】(1)由数表知，$P(AB)=\frac2{25},P(A)=\frac{8+2}{25}=\frac25,P(B|A)=\frac{P(AB)}{P(A)}=\frac15$。

(2)设事件C：外观和内饰均为同色，事件D：外观内饰都异色，事件E：仅外观或仅内饰同色，依题意，$P(C)=\frac{C_8^2+C_{12}^2+C_2^2+C_3^2}{C_{25}^2}=\frac{49}{150}$；$P(D)=\frac{C_8^1C_3^1+C_{12}^1C_2^1}{C_{25}^2}=\frac{24+24}{300}=\frac{48}{300}=\frac4{25}$；$P(E)=\frac{C_8^1C_2^1+C_{12}^1C_3^1+C_8^1C_{12}^1+C_2^1C_3^1}{C_{25}^2}=\frac{77}{150}$，则 $P(E)>P(C)>P(D)$。

因此抽取的两个模型的外观和内饰均为不同色是一等奖；外观和内饰均为同色是二等奖；外观同色但内饰不同色，或内饰同色但外观不同色是三等奖，奖金额X的可能值为600,300,150，奖金额X的分布列：

| X | 600 | 300 | 150 |
|---|---:|---:|---:|
| P | 4/25 | 49/150 | 77/150 |

奖金额X的期望 $E(X)=600\times\frac4{25}+300\times\frac{49}{150}+150\times\frac{77}{150}=271$（元）。

### 图表

题目表跨页4–5，不能遗漏第二行。答案分布表页16、详解分布表页17各出现一次，均保留行列。

## 17

题型：解答题。题目页5–6；答案/解析页17–18。

### 题目

如图，PB是圆柱OO₁的母线，四边形ABCD是底面内接正方形。点E,F是棱BC,CD上的动点（E,F不与端点重合），且CE=DF。

(1)证明：AE⊥平面PBF；

(2)已知圆柱OO₁的体积为π，PB=2，点A到直线PF的距离是1。

（i）求CE的长度；（ii）求直线CD与平面PAE所成角的正弦值。

### 答案

(1)在正方形ABCD中，由CE=DF，得BE=CF，$\tan\angle BAE=\frac{BE}{AB}=\frac{CF}{BC}=\tan\angle CBF$，则∠BAE=∠CBF，∠BAE+∠FBA=∠CBF+∠FBA=90°，因此AE⊥BF。由PB是圆柱OO₁的母线，得PB⊥平面ABCD，而AE⊂平面ABCD，则AE⊥PB。又BF∩PB=B，BF,PB⊂平面PBF，所以AE⊥平面PBF。

(2)（i）$CE=\frac13$；（ii）$\frac{\sqrt{14}}7$。

### 解析

【分析】(1)利用正方形的特征，线面垂直的性质、判断推理得证。(2)（i）以点B为原点建立空间直角坐标系，利用点到直线距离的向量求法列式求出CE；（ii）求出平面PAE的法向量，再利用线面角的向量法求解。

【详解】(1)略。

(2)（i）设圆柱OO₁的底面圆半径为r，圆柱OO₁的体积为π，PB=2，得 $\pi r^2 PB=\pi$，解得 $r=\frac{\sqrt2}2$，则AB=BC=1。显然直线BA,BC,BP两两垂直，以点B为原点，直线BA,BC,BP分别为x,y,z轴建立空间直角坐标系。则A(1,0,0),C(0,1,0),D(1,1,0),P(0,0,2)，设BE=t(0<t<1)，则E(0,t,0),F(t,1,0)，$\overrightarrow{AP}=(-1,0,2),\overrightarrow{PF}=(t,1,-2)$。

由点A到直线PF的距离是1，得 $\sqrt{|\overrightarrow{AP}|^2-(\frac{\overrightarrow{AP}\cdot\overrightarrow{PF}}{|\overrightarrow{PF}|})^2}=1$，则 $5-(\frac{-t-4}{\sqrt{t^2+5}})^2=1$，而0<t<1，解得 $t=\frac23$，所以 $CE=BC-BE=\frac13$。

（ii）$\overrightarrow{CD}=(1,0,0),\overrightarrow{AE}=(-1,\frac23,0)$，设平面PAE的法向量为 $\vec n=(x,y,z)$，则 $\vec n\cdot\overrightarrow{AP}=-x+2z=0,\vec n\cdot\overrightarrow{AE}=-x+\frac23y=0$，取z=1，得 $\vec n=(2,3,1)$。设直线CD与平面PAE所成的角为θ，则 $\sin\theta=|\cos\langle\vec n,\overrightarrow{CD}\rangle|=\frac{|\vec n\cdot\overrightarrow{CD}|}{|\vec n||\overrightarrow{CD}|}=\frac2{\sqrt{14}\cdot1}=\frac{\sqrt{14}}7$，所以直线CD与平面PAE所成角的正弦值为 $\frac{\sqrt{14}}7$。

### 图表

题目页6圆柱图标O、O₁、P、A、B、C、D、E、F；解析页17同图增加以B为原点的x、y、z轴，含必要实线/虚线。答案块中的(1)完整证明在“详解(1)略”之前，不能只保留“略”。

## 18

题型：解答题。题目页6；答案/解析页18–19。

### 题目

已知A、B分别为x轴、y轴上的动点，$|AB|=2,\overrightarrow{BC}=\lambda\overrightarrow{BA}(0<\lambda<1)$。

(1)讨论C点的运动轨迹Γ表示的图形；

(2)若AB与Γ只有一个交点，求△AOB面积的最大值（O为坐标原点）。

### 答案

(1)答案见解析；(2)1。

### 解析

【分析】(1)设C(x,y)，A(a,0)，B(0,b)，由 $|AB|=2$ 和 $\overrightarrow{BC}=\lambda\overrightarrow{BA}(0<\lambda<1)$，可得 $\frac{x^2}{(2\lambda)^2}+\frac{y^2}{(2-2\lambda)^2}=1$，再讨论λ的取值可得出C点的运动轨迹Γ表示的图形；(2)设AB方程为 $\frac xa+\frac yb=1$，联立直线与椭圆的方程，由Δ=0得 $a=\pm2\sqrt\lambda,b=\pm2\sqrt{1-\lambda}$，表示出△AOB面积结合基本不等式即可得出答案。

【详解】(1)设C(x,y)，A(a,0)，B(0,b)，则 $x=\lambda a,y=(1-\lambda)b$，由 $|AB|=2$ 得 $a^2+b^2=\frac{x^2}{\lambda^2}+\frac{y^2}{(1-\lambda)^2}=4$，∴ $\frac{x^2}{(2\lambda)^2}+\frac{y^2}{(2-2\lambda)^2}=1$。所以当 $\lambda\in(0,\frac12)$ 时Γ为焦点在y轴上的椭圆，$\lambda=\frac12$ 时Γ为圆 $x^2+y^2=1$，$\lambda\in(\frac12,1)$ 时Γ为焦点在x轴上的椭圆。

(2)由题意可知直线不与坐标轴平行且不过原点，故设其方程为 $\frac xa+\frac yb=1$，联立 $\frac{x^2}{(2\lambda)^2}+\frac{y^2}{(2-2\lambda)^2}=1,\frac xa+\frac yb=1$ 得 $(\frac{4\lambda^2}{a^2}-2\lambda+1)x^2-\frac{2\lambda^2b^2}a x+\lambda^2(b^2-4\lambda^2+8\lambda-4)=0$。

由Δ=0得 $4\lambda^2(\frac{b^2}{a^2}+1)-8\lambda+4-b^2=4\lambda^2\frac{a^2+b^2}{a^2}-8\lambda+a^2=\frac{16\lambda^2}{a^2}-8\lambda+a^2=(\frac{4\lambda}a-a)^2=0$，∴ $a^2=4\lambda\Rightarrow a=\pm2\sqrt\lambda,b=\pm2\sqrt{1-\lambda}$。

所以 $S_{\triangle AOB}=\frac12|2\sqrt\lambda\cdot2\sqrt{1-\lambda}|\le\frac12|\frac{(2\sqrt\lambda)^2+(2\sqrt{1-\lambda})^2}2|=1$，当且仅当 $\lambda=\frac12$ 时等号成立。

源文注记：页19一元二次式首项系数原文就是 $4\lambda^2/a^2-2\lambda+1$，按源文保留；不为数学等价性重写。

### 图表

解析页18：坐标轴x,y，原点O，截距点A,B，AB上的C。保留矢量方向关系。

## 19

题型：解答题。题目页7；答案/解析页19–21。

### 题目

已知 $f(x)=xe^x+ae^x-1$。

(1)若a≥0，证明：$f(x)\ge x+\ln x$ 恒成立。

(2)令 $g_n(x)=f(x)-n$，且 $\forall n\in N^*$，$g_n(x)$ 有唯一的正零点xₙ。

（i）求a的取值范围；（ii）当a=1时，证明：$2(\sqrt{n+2}-\sqrt2)<\frac1{x_1}+\frac1{x_2}+\cdots+\frac1{x_n}<2+n+2\ln n$。

### 答案

(1)令 $h(x)=e^x-x-1$，则 $h'(x)=e^x-1$。当x≤0时h'(x)≤0，当x≥0时h'(x)≥0，所以h(x)在(−∞,0]上单调递减，在[0,+∞)上单调递增。所以有 $h(x)\ge h(0)=0$，即 $e^x\ge x+1$。当a≥0时，$f(x)-(x+\ln x)=e^{x+\ln x}-(x+\ln x)-1+ae^x\ge ae^x\ge0$ 恒成立。

(2)（i）a<2；

（ii）由题意可知 $(x_n+1)e^{x_n}=n+1$，也即 $\ln(x_n+1)+x_n=\ln(n+1)$。由(1)知 $e^x\ge x+1$，则 $x=e^{\ln x}\ge\ln x+1$，即 $x-1\ge\ln x$，且 $x=\ln e^x\ge\ln(x+1)$。因此有 $\ln(n+1)=\ln(x_n+1)+x_n\ge2\ln(x_n+1)$，即 $n+1\ge(x_n+1)^2$，也即 $\sqrt{n+1}\ge x_n+1$，可得 $\sqrt{n+1}>x_n$。

所以有 $\frac1{x_n}>\frac1{\sqrt{n+1}}=\frac2{2\sqrt{n+1}}>\frac2{\sqrt{n+2}+\sqrt{n+1}}=2(\sqrt{n+2}-\sqrt{n+1})$，故 $\frac1{x_1}+\frac1{x_2}+\cdots+\frac1{x_n}>2(\sqrt3-\sqrt2+\sqrt4-\sqrt3+\cdots+\sqrt{n+2}-\sqrt{n+1})=2(\sqrt{n+2}-\sqrt2)$。

又因为 $x-1\ge\ln x$，所以有 $\frac{x_n+1}{n+1}-1\ge\ln\frac{x_n+1}{n+1}=\ln(x_n+1)-\ln(n+1)$。根据题意有 $\ln(x_n+1)+x_n=\ln(n+1)$，从而有 $-x_n=\ln(x_n+1)-\ln(n+1)\le\frac{x_n+1}{n+1}-1$，即 $1-\frac1{n+1}\le\frac{x_n}{n+1}+x_n$，可得 $x_n\ge\frac n{n+2}$，进一步得 $\frac1{x_n}\le1+\frac2n$。

又 $g_1(\frac13)=\frac43e^{1/3}-2\ne0$，所以 $x_1\ne\frac13$，所以 $\frac1{x_1}\ne3$，故 $\frac1{x_1}<3$。所以 $\frac1{x_1}+\frac1{x_2}+\cdots+\frac1{x_n}<n+2(1+\frac12+\frac13+\cdots+\frac1n)$。

由 $x-1\ge\ln x$ 可得 $\frac1x-1\ge\ln\frac1x$，也即 $1-\frac1x\le\ln x$。令 $x=\frac n{n-1}$ 得 $1-\frac{n-1}n\le\ln\frac n{n-1}$，进一步得 $\frac1n\le\ln\frac n{n-1}(n\ge2)$。所以 $1+\frac12+\frac13+\cdots+\frac1n\le1+\ln\frac21+\ln\frac32+\cdots+\ln\frac n{n-1}=1+\ln n$。

故 $\frac1{x_1}+\frac1{x_2}+\cdots+\frac1{x_n}<n+2(1+\frac12+\frac13+\cdots+\frac1n)\le n+2(1+\ln n)$。综上有 $2(\sqrt{n+2}-\sqrt2)<\frac1{x_1}+\frac1{x_2}+\cdots+\frac1{x_n}<2+n+2\ln n$。

### 解析

【分析】(1)证明 $e^x\ge x+1$ 恒成立，再将x替换为 $x+\ln x$ 放缩证明原不等式即可；(2)（i）令 $g_n(x)=(x+a)e^x-(n+1)$，求导研究gₙ(x)的单调性，证明gₙ(x)在(−a,+∞)有唯一零点xₙ，最后再对a的范围进行分类讨论即可；（ii）结合(1)中 $e^x\ge x+1$ 推得 $x\ge\ln(x+1)$，并结合（i）中的零点对应的等式，放缩可得 $\ln(n+1)\ge2\ln(x_n+1)$，进一步得到 $\sqrt{n+1}>x_n$，再结合裂项相消法即可证明原不等式左边。对于不等式右边，由不等式 $x-1\ge\ln x$，令 $x=\frac{x_n+1}{n+1}$ 代入，并结合（i）中的零点对应的等式，可证明 $\frac1{x_n}\le1+\frac2n$，根据 $1-\frac1x\le\ln x$，令 $x=\frac n{n-1}$ 代入，可证 $\frac1n\le\ln\frac n{n-1}$，最后结合两者放缩即可证明原不等式右边。

【详解】(1)略。

(2)（i）由题意有 $g_n(x)=(x+a)e^x-(n+1)$ 有唯一的正零点xₙ，因为 $g'_n(x)=(x+a+1)e^x$，所以gₙ(x)在(−∞,−a−1)上单调递减，在(−a−1,+∞)上单调递增。当x<−a−1时，gₙ(x)<0；$g_n(-a-1)=-e^{-a-1}-(n+1)<0,g_n(-a)=-(n+1)<0$。当x→+∞时，gₙ(x)→+∞。由零点存在性定理可知，gₙ(x)在(−a,+∞)有唯一零点xₙ。当a≤0时，−a≥0，则xₙ>0满足题意；当a>0时，要保证xₙ>0，则只要 $g_n(0)=a-n-1<0$，即a<n+1，$n\in N^*$恒成立，所以0<a<2。综合可得a<2。

（ii）略。

### 图表

无图。页19–20答案块有(1)和(2)(ii)完整证明，页20–21详解中的“略”不能作为全文解析替代。
