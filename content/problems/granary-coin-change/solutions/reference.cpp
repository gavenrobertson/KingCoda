class Solution {
public:
    int fewestCoins(vector<int>& denominations, int price) {
        const int INF = INT_MAX / 2;
        vector<int> best(price + 1, INF);
        best[0] = 0;
        for (int x = 1; x <= price; x++)
            for (int d : denominations)
                if (d <= x) best[x] = min(best[x], best[x - d] + 1);
        return best[price] >= INF ? -1 : best[price];
    }
};
