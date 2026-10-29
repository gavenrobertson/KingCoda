class Solution {
public:
    int fewestEdits(string& draft, string& approved) {
        int n = draft.size(), m = approved.size();
        vector<int> prev(m + 1), cur(m + 1);
        iota(prev.begin(), prev.end(), 0);
        for (int i = 1; i <= n; i++) {
            cur[0] = i;
            for (int j = 1; j <= m; j++) {
                if (draft[i - 1] == approved[j - 1]) cur[j] = prev[j - 1];
                else cur[j] = 1 + min({prev[j], cur[j - 1], prev[j - 1]});
            }
            swap(prev, cur);
        }
        return prev[m];
    }
};
