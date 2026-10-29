class Solution {
public:
    vector<vector<int>> allSettings(vector<int>& jewels) {
        sort(jewels.begin(), jewels.end());
        int n = jewels.size();
        vector<vector<int>> out;
        out.reserve(1 << n);
        for (int mask = 0; mask < (1 << n); mask++) {
            vector<int> s;
            for (int i = 0; i < n; i++)
                if (mask >> i & 1) s.push_back(jewels[i]);
            out.push_back(s);
        }
        return out;
    }
};
