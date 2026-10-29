class Solution {
public:
    vector<int> countByPrefix(vector<string>& titles, vector<string>& prefixes) {
        vector<array<int, 26>> next(1);
        vector<int> pass(1, 0);
        next[0].fill(-1);
        for (auto& t : titles) {
            int node = 0;
            for (char ch : t) {
                int c = ch - 'a';
                if (next[node][c] == -1) {
                    next[node][c] = next.size();
                    next.emplace_back();
                    next.back().fill(-1);
                    pass.push_back(0);
                }
                node = next[node][c];
                pass[node]++;
            }
        }
        vector<int> out;
        out.reserve(prefixes.size());
        for (auto& p : prefixes) {
            int node = 0;
            for (char ch : p) {
                node = next[node][ch - 'a'];
                if (node == -1) break;
            }
            out.push_back(node == -1 ? 0 : pass[node]);
        }
        return out;
    }
};
