class Solution {
public:
    int fewestSteps(vector<string>& realm) {
        int rows = realm.size(), cols = realm[0].size();
        vector<int> dist(rows * cols, -1);
        queue<int> q;
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                if (realm[r][c] == 'S') { dist[r * cols + c] = 0; q.push(r * cols + c); }
        const int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
        while (!q.empty()) {
            int cur = q.front(); q.pop();
            int r = cur / cols, c = cur % cols;
            if (realm[r][c] == 'E') return dist[cur];
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || realm[nr][nc] == '#') continue;
                int nxt = nr * cols + nc;
                if (dist[nxt] != -1) continue;
                dist[nxt] = dist[cur] + 1;
                q.push(nxt);
            }
        }
        return -1;
    }
};
