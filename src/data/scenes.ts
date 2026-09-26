export type ModuleId = 'model' | 'motion' | 'multiplication' | 'intersection' | 'partial';
export type SceneId =
  | 'edge' | 'screw'
  | 'edge-glide' | 'edge-climb' | 'screw-glide' | 'cross-slip'
  | 'frank-read' | 'double-cross-slip'
  | 'edge-edge-perpendicular' | 'edge-edge-parallel' | 'screw-screw' | 'edge-screw'
  | 'extended' | 'shockley' | 'frank';

export interface SceneInfo {
  id: SceneId;
  module: ModuleId;
  title: string;
  subtitle: string;
  relation: string;
  result: string;
  observe: string[];
  stages: string[];
  stageThresholds?: number[];
  caution?: string;
  animated: boolean;
}

export const modules: { id: ModuleId; label: string; short: string; index: string }[] = [
  { id: 'model', label: '位错模型', short: '结构', index: '01' },
  { id: 'motion', label: '位错运动', short: '运动', index: '02' },
  { id: 'multiplication', label: '位错增殖', short: '增殖', index: '03' },
  { id: 'intersection', label: '位错交割', short: '交割', index: '04' },
  { id: 'partial', label: '扩展位错', short: '扩展', index: '05' },
];

export const scenes: SceneInfo[] = [
  { id: 'edge', module: 'model', title: '刃型位错', subtitle: '额外半原子面终止于位错线', relation: 'b ⟂ L · 滑移面包含 b 与 L', result: '额外半原子面的终止边缘就是刃型位错线。', observe: ['转动模型，找到上方的额外半原子面。', '沿位错线观察终止边缘。', '比较伯氏矢量 b 与线方向 L。'], stages: ['结构观察'], animated: false },
  { id: 'screw', module: 'model', title: '螺型位错', subtitle: '晶面绕位错线产生螺旋错移', relation: 'b ∥ L · 多个包含 L 的候选滑移面', result: '螺型位错是晶格的螺旋错移，不是一根孤立的螺旋线。', observe: ['从顶面观察绕芯的原子层高度。', '旋转至侧面，观察金色台阶与滑移分界；隐藏时可用“表面台阶”开关恢复。', '比较 b 与 L 的平行关系。'], stages: ['结构观察'], animated: false },
  { id: 'edge-glide', module: 'motion', title: '刃型位错滑移', subtitle: '位错沿原滑移面前进', relation: 'L ∥ z · b ∥ x · 滑移面 xz', result: '位错扫出晶体后，两侧留下一个伯氏矢量大小的相对错动。', observe: ['用“切应力”开关，比较紫色应力箭头与青绿色运动路径。', '位错线沿 x 方向推进，已滑过区域扩大。', '在终态比较上下两部分的错动和金色表面错台。'], stages: ['滑移起始', '沿面滑移', '错动形成'], animated: true },
  { id: 'edge-climb', module: 'motion', title: '刃型位错攀移', subtitle: '空位扩散与位错面外运动', relation: 'L ∥ z · 攀移方向垂直原滑移面', result: '攀移改变位错所在晶面，并依赖点缺陷扩散。', observe: ['空位沿晶格位向额外半面的终止边缘扩散。', '空位标记在芯附近收缩后，位错线离开原滑移面。', '比较攀移方向与滑移方向。'], stages: ['空位出现', '空位扩散', '面外攀移'], animated: true, caution: '单个空位是代表性截面的教学示意，不表示整条位错线只靠一个空位完成攀移。' },
  { id: 'screw-glide', module: 'motion', title: '螺型位错滑移', subtitle: '螺型位错在允许面内移动', relation: 'b ∥ L · 当前滑移面包含 L', result: '螺型位错沿所选允许滑移面推进。', observe: ['用“切应力”开关，比较紫色应力与青绿色运动路径方向。', '打开“伯氏矢量”，核对 b 与 L 平行。', '若未显示，打开“表面台阶”，旋转视角观察金色台阶随位错推进。'], stages: ['初始', '面内滑移', '形成台阶'], animated: true },
  { id: 'cross-slip', module: 'motion', title: '螺型位错交滑移', subtitle: '从滑移面 A 转入滑移面 B', relation: 'b ∥ L · A、B 两面均包含 L', result: '纯螺型段可以转入另一个包含同一 b 的滑移面。', observe: ['先沿 A 面运动。', '到两面的交线附近转向。', '打开“伯氏矢量”，比较 A、B 两面滑移时 b 的方向。'], stages: ['A 面滑移', '转入 B 面', 'B 面滑移'], animated: true },
  { id: 'frank-read', module: 'multiplication', title: 'Frank–Read 源', subtitle: '固定端之间连续生成位错环', relation: '两端固定 · 弓出与环位于同一滑移面', result: '固定段弓出、相遇、脱离后，源段可再次工作。', observe: ['A、B 两端固定；用“切应力”开关可查看紫色受力箭头。', '线越过半圆后继续弓出并相遇。', '闭合环扩张，源线恢复并再次弓出。'], stages: ['固定源段', '受力弓出', '首个环脱离', '源线再次弓出', '第二个环生成'], stageThresholds: [.05, .385, .55, .865], animated: true, caution: '重联瞬间与环分离采用教学几何插值；具体位错拓扑仍需学科签收。' },
  { id: 'double-cross-slip', module: 'multiplication', title: '双交滑移增殖', subtitle: '螺型段绕过障碍并形成环', relation: '两次交滑移 · 最终面平行于原面', result: '两次交滑移可使局部位错段偏离原轨道并形成增殖条件。', observe: ['原段先在主滑移面接近障碍。', '局部段沿相交晶面转入另一高度。', '在平行晶面展开后观察连接弧逐渐闭合、分离并扩张。'], stages: ['接近障碍', '第一次交滑移', '第二次交滑移', '环形成'], stageThresholds: [.44, .62, .86], animated: true, caution: '三面转移路径是候选几何；连接弧、jog、闭环和具体晶体学取向仍需学科验收。' },
  { id: 'edge-edge-perpendicular', module: 'intersection', title: '刃—刃交割 · b₁ ⟂ b₂', subtitle: '两条刃型线在运动中相遇', relation: 'b₁ ⟂ b₂ · 两条线均与各自 b 垂直', result: '所选构型中，两条线上可产生面外台阶段。', observe: ['初态两线没有相交。', '相向运动到共同交点。', '交后辨认两条线的局部台阶。'], stages: ['交割前', '相向运动', '发生交割', '交割后'], stageThresholds: [.04, .48, .58], animated: true, caution: '候选构型；jog 类型待学科验收。' },
  { id: 'edge-edge-parallel', module: 'intersection', title: '刃—刃交割 · b₁ ∥ b₂', subtitle: '两条刃型线产生折线', relation: 'b₁ ∥ b₂ · 两条线均与 b 垂直', result: '本构型中，两条线的面内段发生折线变化。', observe: ['初态两线分离。', '在中间位置交割。', '两条线均出现面内折线。'], stages: ['交割前', '相向运动', '发生交割', '交割后'], stageThresholds: [.04, .48, .58], animated: true, caution: '本构型为 kink；不能概称所有平行 b 交割都形成 jog。' },
  { id: 'screw-screw', module: 'intersection', title: '螺—螺交割 · b₁ ⟂ b₂', subtitle: '交点附近形成边型台阶段', relation: '两条线均与各自 b 平行', result: '所选滑移面使交后局部台阶段具有边型特征。', observe: ['比较两线的滑移面。', '观察移动至交点的过程。', '隐藏晶面，辨认台阶段方向。'], stages: ['交割前', '相向运动', '发生交割', '交割后'], stageThresholds: [.04, .48, .58], animated: true, caution: '候选滑移面构型待学科验收。' },
  { id: 'edge-screw', module: 'intersection', title: '刃—螺交割 · b₁ ⟂ b₂', subtitle: '区分 jog 与 kink', relation: '刃型 b₁ ⟂ L₁ · 螺型 b₂ ∥ L₂', result: '所选构型中刃型线上为 jog，螺型线上为 kink。', observe: ['初态两线没有相交。', '交点处两线各自偏移。', '区分面外 jog 与面内 kink。'], stages: ['交割前', '相向运动', '发生交割', '交割后'], stageThresholds: [.04, .48, .58], animated: true, caution: '结果只适用于所示构型；待学科验收。' },
  { id: 'extended', module: 'partial', title: '完整位错 → 扩展位错', subtitle: 'FCC 完整位错分解为两个 Shockley 不全位错', relation: 'a/2[1 −1 0] = a/6[2 −1 −1] + a/6[1 −2 1]', result: '两条部分位错之间的带状区域为层错。', observe: ['完整线逐渐分开。', '层错带宽度随间距增大。', '观察两条 b 的矢量和。'], stages: ['完整位错', '开始分解', '部分位错分离', '层错形成'], animated: true },
  { id: 'shockley', module: 'partial', title: 'Shockley 不全位错', subtitle: 'FCC {111} 面内的部分位错', relation: 'b = a/6〈112〉 · b 位于 (111) 面内', result: 'Shockley 不全位错可在其所在密排面上滑移。', observe: ['找到层错边界上的位错线。', '比较 b 与层错面的关系。', '观察层错带和另一条部分位错。'], stages: ['结构观察'], animated: false },
  { id: 'frank', module: 'partial', title: 'Frank 不全位错', subtitle: '层错边界上的面外伯氏矢量', relation: 'b = a/3〈111〉 · b ⟂ (111)', result: 'Frank 不全位错不在该面上保守滑移，可通过攀移运动。', observe: ['观察圆盘内缺失的原子层与上方层的法向闭合。', '找到层错边界并比较 b 与层错面法向。', '转动模型确认 b 不在面内。'], stages: ['结构观察'], animated: false, caution: '缺层与闭合是内禀层错环的教学构型；位错芯及真实弛豫仍待学科审核。' },
];

export const sceneById = Object.fromEntries(scenes.map(scene => [scene.id, scene])) as Record<SceneId, SceneInfo>;
