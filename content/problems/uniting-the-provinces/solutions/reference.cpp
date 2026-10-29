class Solution {
    vector<int> parent, size_;
    int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }
public:
    vector<int> kingdomsAfterEachRoad(int n, vector<vector<int>>& roads) {
        parent.resize(n);
        size_.assign(n, 1);
        iota(parent.begin(), parent.end(), 0);
        int kingdoms = n;
        vector<int> out;
        out.reserve(roads.size());
        for (auto& r : roads) {
            int a = find(r[0]), b = find(r[1]);
            if (a != b) {
                if (size_[a] < size_[b]) swap(a, b);
                parent[b] = a;
                size_[a] += size_[b];
                kingdoms--;
            }
            out.push_back(kingdoms);
        }
        return out;
    }
};
