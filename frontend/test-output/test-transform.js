"use strict";
// 简单的转换测试，用于验证BaseApiService的逻辑
Object.defineProperty(exports, "__esModule", { value: true });
// 模拟BaseApiService中的转换逻辑
function transformResponse(response) {
    var _a;
    const data = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.data) || response.data;
    if (!data || typeof data !== 'object') {
        return data;
    }
    return unifyPaginatedData(data);
}
function unifyPaginatedData(data) {
    const listFieldMap = {
        'users': 'items',
        'roles': 'items',
        'logs': 'items',
        'records': 'items',
        'sessions': 'items',
        'assets': 'items',
        'groups': 'items',
        'credentials': 'items',
    };
    for (const [oldField, newField] of Object.entries(listFieldMap)) {
        if (data[oldField] !== undefined && Array.isArray(data[oldField])) {
            data[newField] = data[oldField];
            if (oldField !== newField) {
                delete data[oldField];
            }
            break;
        }
    }
    if (data.pagination) {
        Object.assign(data, data.pagination);
        delete data.pagination;
    }
    return data;
}
// 测试用例
const testCases = [
    {
        name: 'Transform users to items',
        input: {
            data: {
                data: {
                    users: [{ id: 1, name: 'User 1' }],
                    total: 1,
                    page: 1,
                    page_size: 10
                }
            }
        },
        expected: {
            items: [{ id: 1, name: 'User 1' }],
            total: 1,
            page: 1,
            page_size: 10
        }
    },
    {
        name: 'Handle nested pagination',
        input: {
            data: {
                data: {
                    users: [{ id: 1 }],
                    pagination: {
                        total: 100,
                        page: 2,
                        page_size: 20
                    }
                }
            }
        },
        expected: {
            items: [{ id: 1 }],
            total: 100,
            page: 2,
            page_size: 20
        }
    },
    {
        name: 'Direct data structure',
        input: {
            data: {
                items: [{ id: 1 }],
                total: 1
            }
        },
        expected: {
            items: [{ id: 1 }],
            total: 1
        }
    }
];
// 运行测试
console.log('Testing BaseApiService transformation logic:\n');
testCases.forEach(test => {
    const result = transformResponse(test.input);
    const passed = JSON.stringify(result) === JSON.stringify(test.expected);
    console.log(`${passed ? '✅' : '❌'} ${test.name}`);
    if (!passed) {
        console.log('  Expected:', JSON.stringify(test.expected));
        console.log('  Got:', JSON.stringify(result));
    }
});
console.log('\nAll core transformations tested!');
