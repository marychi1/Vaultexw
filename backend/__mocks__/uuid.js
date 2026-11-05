let sequence = 0;

exports.v4 = function () {
    sequence += 1;
    return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, '0')}`;
};

exports.default = { v4: exports.v4 };
