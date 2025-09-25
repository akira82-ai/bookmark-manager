/**
 * 3大指标智能判定引擎
 * 优先级：访问次数 > 访问时长 > 访问深度
 */
class MetricsJudgmentEngine {
    constructor() {
        // 各级别阈值配置
        this.thresholds = {
            // 访问次数阈值（3天内）
            visitCount: {
                level0: 3,   // 3次 - 基础关注
                level1: 5,   // 5次 - 适度关注
                level2: 8,   // 8次 - 高度关注
                level3: 12,  // 12次 - 强烈关注
                level4: 20   // 20次 - 极度关注
            },
            // 访问时长阈值（30-180秒范围）
            browseDuration: {
                level0: 30,   // 30秒 - 快速浏览（排除误点击）
                level1: 60,   // 1分钟 - 初步关注
                level2: 90,   // 1.5分钟 - 认真浏览
                level3: 120,  // 2分钟 - 深度关注
                level4: 180   // 3分钟 - 长时间专注
            },
            // 访问深度阈值（屏幕数）
            browseDepth: {
                level0: 1.5,  // 1.5屏 - 基础滚动
                level1: 3.0,  // 3屏 - 适度深度
                level2: 5.0,  // 5屏 - 深度浏览
                level3: 8.0,  // 8屏 - 很深浏览
                level4: 12.0  // 12屏 - 极深浏览
            }
        };

        // 权重配置：访问次数50%，访问时长30%，访问深度20%
        this.weights = {
            visit: 0.5,
            duration: 0.3,
            depth: 0.2
        };

        // 级别名称映射
        this.levelNames = {
            0: '基础关注',
            1: '适度关注',
            2: '高度关注',
            3: '强烈关注',
            4: '极度关注'
        };

        // 调试模式
        this.debugMode = false;
    }

    /**
     * 主判定入口 - 优先级：访问次数 > 访问时长 > 访问深度
     * @param {Object} metrics - 3大指标数据
     * @returns {Object} 判定结果
     */
    judge(metrics) {
        const { visitCount, browseDuration, browseDepth } = metrics;


        // 第一层：访问次数判定（权重最高，具有一票否决权）
        const visitCountResult = this.judgeVisitCount(visitCount);

        if (visitCountResult.level === -1) {
            return this.createFailureResult('访问次数不足', visitCountResult);
        }

        // 第二层：访问时长判定（中等权重）
        const durationResult = this.judgeBrowseDuration(browseDuration);

        if (durationResult.level === -1) {
            return this.createFailureResult('访问时长不足', durationResult);
        }

        // 第三层：访问深度判定（辅助权重）
        const depthResult = this.judgeBrowseDepth(browseDepth);

        if (depthResult.level === -1) {
            return this.createFailureResult('访问深度不足', depthResult);
        }

        // 综合判定：计算加权分数
        const weightedScore = this.calculateWeightedScore(
            visitCountResult.level,
            durationResult.level,
            depthResult.level
        );

        // 应用优先级保护机制
        const finalLevel = this.applyPriorityProtection(
            weightedScore,
            visitCountResult.level,
            durationResult.level,
            depthResult.level
        );

        const result = {
            passed: true,
            level: finalLevel,
            levelName: this.levelNames[finalLevel],
            weightedScore: weightedScore,
            confidence: this.calculateConfidence(visitCountResult, durationResult, depthResult),
            detailResults: {
                visitCount: visitCountResult,
                browseDuration: durationResult,
                browseDepth: depthResult
            },
            metrics: metrics,
            thresholdExceeded: this.getThresholdExceededInfo(visitCountResult, durationResult, depthResult)
        };


        return result;
    }

    /**
     * 访问次数判定（第一优先级）
     */
    judgeVisitCount(count) {
        const thresholds = this.thresholds.visitCount;

        if (count < thresholds.level0) {
            return { level: -1, reason: `访问次数${count}次 < 最小阈值${thresholds.level0}次` };
        }

        let level = 0;
        if (count >= thresholds.level4) level = 4;
        else if (count >= thresholds.level3) level = 3;
        else if (count >= thresholds.level2) level = 2;
        else if (count >= thresholds.level1) level = 1;

        const nextThreshold = thresholds[`level${level + 1}`];
        const progress = level < 4 ? (count - thresholds[`level${level}`]) / (nextThreshold - thresholds[`level${level}`]) : 1;

        return {
            level: level,
            value: count,
            threshold: thresholds[`level${level}`],
            nextThreshold: nextThreshold,
            progress: Math.min(1, progress),
            reason: `访问次数达标，达到${this.levelNames[level]}标准`
        };
    }

    /**
     * 访问时长判定（第二优先级）
     */
    judgeBrowseDuration(duration) {
        const thresholds = this.thresholds.browseDuration;

        if (duration < thresholds.level0) {
            return { level: -1, reason: `访问时长${duration}秒 < 最小阈值${thresholds.level0}秒` };
        }

        let level = 0;
        if (duration >= thresholds.level4) level = 4;
        else if (duration >= thresholds.level3) level = 3;
        else if (duration >= thresholds.level2) level = 2;
        else if (duration >= thresholds.level1) level = 1;

        const nextThreshold = thresholds[`level${level + 1}`];
        const progress = level < 4 ? (duration - thresholds[`level${level}`]) / (nextThreshold - thresholds[`level${level}`]) : 1;

        return {
            level: level,
            value: duration,
            threshold: thresholds[`level${level}`],
            nextThreshold: nextThreshold,
            progress: Math.min(1, progress),
            reason: `访问时长达标，达到${this.levelNames[level]}标准`
        };
    }

    /**
     * 访问深度判定（第三优先级）
     */
    judgeBrowseDepth(depth) {
        const thresholds = this.thresholds.browseDepth;

        if (depth < thresholds.level0) {
            return { level: -1, reason: `访问深度${depth.toFixed(1)}屏 < 最小阈值${thresholds.level0}屏` };
        }

        let level = 0;
        if (depth >= thresholds.level4) level = 4;
        else if (depth >= thresholds.level3) level = 3;
        else if (depth >= thresholds.level2) level = 2;
        else if (depth >= thresholds.level1) level = 1;

        const nextThreshold = thresholds[`level${level + 1}`];
        const progress = level < 4 ? (depth - thresholds[`level${level}`]) / (nextThreshold - thresholds[`level${level}`]) : 1;

        return {
            level: level,
            value: depth,
            threshold: thresholds[`level${level}`],
            nextThreshold: nextThreshold,
            progress: Math.min(1, progress),
            reason: `访问深度达标，达到${this.levelNames[level]}标准`
        };
    }

    /**
     * 计算加权分数
     */
    calculateWeightedScore(visitLevel, durationLevel, depthLevel) {
        const weightedScore =
            (visitLevel * this.weights.visit) +
            (durationLevel * this.weights.duration) +
            (depthLevel * this.weights.depth);

        return Math.min(4, weightedScore);
    }

    /**
     * 应用优先级保护机制
     */
    applyPriorityProtection(weightedScore, visitLevel, durationLevel, depthLevel) {
        let finalLevel = Math.round(weightedScore);

        // 访问次数保护：如果访问次数很低，整体级别受限
        if (visitLevel === 0 && finalLevel > 1) finalLevel = 1;
        if (visitLevel === 1 && finalLevel > 2) finalLevel = 2;

        // 访问时长调节：如果访问时长很低，适当降级
        if (durationLevel === 0 && finalLevel > 1) finalLevel = Math.max(0, finalLevel - 1);

        // 确保级别在有效范围内
        return Math.max(0, Math.min(4, finalLevel));
    }

    /**
     * 计算判定置信度
     */
    calculateConfidence(visitResult, durationResult, depthResult) {
        // 基于各指标的达成度计算置信度
        const visitConfidence = Math.min(1, visitResult.value / visitResult.threshold);
        const durationConfidence = Math.min(1, durationResult.value / durationResult.threshold);
        const depthConfidence = Math.min(1, depthResult.value / depthResult.threshold);

        // 加权平均置信度
        return (visitConfidence * this.weights.visit +
                durationConfidence * this.weights.duration +
                depthConfidence * this.weights.depth);
    }

    /**
     * 获取阈值超越信息
     */
    getThresholdExceededInfo(visitResult, durationResult, depthResult) {
        return {
            visitCount: {
                multiple: visitResult.value / visitResult.threshold,
                exceeded: visitResult.value - visitResult.threshold
            },
            browseDuration: {
                multiple: durationResult.value / durationResult.threshold,
                exceeded: durationResult.value - durationResult.threshold
            },
            browseDepth: {
                multiple: depthResult.value / depthResult.threshold,
                exceeded: depthResult.value - depthResult.threshold
            }
        };
    }

    /**
     * 创建失败结果
     */
    createFailureResult(reason, failedResult) {
        return {
            passed: false,
            level: -1,
            reason: reason,
            failedMetric: failedResult,
            metrics: failedResult.value
        };
    }

    /**
     * 获取结果文本描述
     */
    getResultText(result) {
        if (result.level === -1) {
            return result.reason;
        }
        return `${this.levelNames[result.level]} (${result.progress.toFixed(1)}%)`;
    }

    /**
     * 获取阈值配置信息
     */
    getThresholdsInfo() {
        return {
            visitCount: this.thresholds.visitCount,
            browseDuration: this.thresholds.browseDuration,
            browseDepth: this.thresholds.browseDepth,
            weights: this.weights
        };
    }

    /**
     * 设置调试模式
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
}

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetricsJudgmentEngine;
} else if (typeof window !== 'undefined') {
    window.MetricsJudgmentEngine = MetricsJudgmentEngine;
}