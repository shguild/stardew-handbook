const categories = [
  { id: 'villagers', name: '村民与送礼', short: '村民', icon: 'Abigail.png', title: '居民', category: 'NPC', hint: '生日 · 好感度 · 日程', pages: ['居民', '友谊', '阿比盖尔', '塞巴斯蒂安', '莉亚', '海莉', '艾米丽', '潘妮', '山姆', '哈维', '艾利欧特', '玛鲁', '谢恩', '科罗布斯'] },
  { id: 'crops', name: '作物与农场', short: '农场', icon: 'Parsnip.png', title: '农作物', category: '农作物', hint: '种植 · 生长 · 收获', pages: ['农作物', '防风草', '草莓', '蓝莓', '杨桃', '上古水果', '南瓜', '蔓越莓', '动物', '农场', '果树', '温室', '洒水器', '稻草人'] },
  { id: 'fish', name: '鱼类与钓鱼', short: '钓鱼', icon: 'Sunfish.png', title: '鱼', category: '鱼', hint: '水域 · 天气 · 出没时间', pages: ['鱼', '钓鱼', '鲶鱼', '太阳鱼', '大嘴鲈鱼', '鳗鱼', '河豚', '鲟鱼', '虹鳟鱼', '鱼王', '传说之鱼', '蟹笼', '鱼塘'] },
  { id: 'mines', name: '矿洞与战斗', short: '矿洞', icon: 'Amethyst.png', title: '矿洞', category: '矿物', hint: '矿物 · 怪物 · 装备', pages: ['矿洞', '骷髅洞穴', '采矿', '战斗', '矿物', '紫水晶', '钻石', '铱矿石', '武器', '戒指', '怪物', '银河剑', '冒险者公会'] },
  { id: 'cooking', name: '烹饪与制作', short: '制作', icon: 'Fried_Egg.png', title: '烹饪', category: '烹饪', hint: '食谱 · 材料 · 手工艺', pages: ['烹饪', '制作', '煎鸡蛋', '南瓜汤', '香辣鳗鱼', '生鱼片', '咖啡', '蜂房', '小桶', '罐头瓶', '熔炉', '宝石复制机'] },
  { id: 'bundles', name: '社区与收集', short: '收集', icon: 'Golden_Walnut.png', title: '收集包', category: null, hint: '献祭 · 金核桃 · 博物馆', pages: ['收集包', '社区中心', '博物馆', '古物', '金核桃', '秘密纸条', '成就', '完美', '星之果实'] },
  { id: 'world', name: '地点与探索', short: '地点', icon: 'Map.png', title: '鹈鹕镇', category: '地点', hint: '地图 · 商店 · 姜岛', pages: ['鹈鹕镇', '姜岛', '煤矿森林', '深山', '沙漠', '海滩', '火山地牢', '皮埃尔的杂货店', '旅行货车', '铁匠铺', '星之果实餐吧'] },
  { id: 'calendar', name: '季节与节日', short: '季节', icon: 'Spring.png', title: '季节', category: '节日', hint: '日历 · 节日 · 天气', pages: ['季节', '春季', '夏季', '秋季', '冬季', '节日', '复活节', '花舞节', '夏威夷宴会', '星露谷展览会', '冬日星盛宴', '夜市', '天气'] },
  { id: 'guides', name: '新手与进阶', short: '指南', icon: 'Stardrop.png', title: '新手指南', category: '游戏机制', hint: '技能 · 任务 · 游戏机制', pages: ['新手指南', '技能', '任务', '运气', '精通', '工具', '钱包', '控制'] }
];
const villagers = [
  {title:'阿比盖尔', image:'Abigail.png'}, {title:'塞巴斯蒂安', image:'Sebastian.png'},
  {title:'莉亚', image:'Leah.png'}, {title:'海莉', image:'Haley.png'},
  {title:'潘妮', image:'Penny.png'}, {title:'山姆', image:'Sam.png'}
];
const seasons = [
  {id:'spring',name:'春',title:'春季',icon:'Spring.png',pages:['防风草','草莓','鲶鱼','复活节']},
  {id:'summer',name:'夏',title:'夏季',icon:'Summer.png',pages:['蓝莓','杨桃','河豚','夏威夷宴会']},
  {id:'fall',name:'秋',title:'秋季',icon:'Fall.png',pages:['南瓜','蔓越莓','鲑鱼','星露谷展览会']},
  {id:'winter',name:'冬',title:'冬季',icon:'Winter.png',pages:['冬季','夜市','冬日星盛宴','矿洞']}
];
const featured = [
  {title:'草莓',image:'Strawberry.png',label:'种植手册'},
  {title:'收集包',image:'Golden_Walnut.png',label:'社区中心'},
  {title:'鱼',image:'Sunfish.png',label:'钓鱼图鉴'},
  {title:'姜岛',image:'Golden_Walnut.png',label:'岛屿探索'}
];
module.exports = {categories,villagers,seasons,featured};
