class Solution {
public:
    vector<int> lanternCounts(int n) {
        vector<int> lit(n + 1, 0);
        for (int i = 1; i <= n; i++) lit[i] = lit[i >> 1] + (i & 1);
        return lit;
    }
};
