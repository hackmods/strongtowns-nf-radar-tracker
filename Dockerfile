FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html results.html guide.html styles.css results.css guide.css app.js results.js ./
COPY data ./data/

EXPOSE 80
